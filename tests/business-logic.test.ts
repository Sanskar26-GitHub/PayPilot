import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CreateInvoiceSchema,
  UpdateDraftSchema,
  LineItemSchema,
  isInvoiceOverdue,
  getEffectiveInvoiceStatus,
} from '../server/types.ts';
import { db } from '../server/db.ts';
import { paypal } from '../server/paypal.ts';
import { gemini } from '../server/gemini.ts';

test('LineItemSchema validates valid item', () => {
  const valid = {
    description: 'Code review',
    quantity: 3,
    unit_price: 150.0,
  };
  const result = LineItemSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test('LineItemSchema rejects non-positive quantity', () => {
  const invalid = {
    description: 'Design mockups',
    quantity: 0,
    unit_price: 100.0,
  };
  const result = LineItemSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test('LineItemSchema rejects negative unit price', () => {
  const invalid = {
    description: 'Consulting',
    quantity: 1,
    unit_price: -50.0,
  };
  const result = LineItemSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test('CreateInvoiceSchema validates proper invoice payload', () => {
  const payload = {
    customer_name: 'Alice Johnson',
    customer_email: 'alice@example.com',
    description: 'Full stack development',
    currency: 'USD',
    issue_date: '2026-10-17',
    due_date: '2026-10-31',
    notes: 'Net 14',
    items: [
      { description: 'Frontend work', quantity: 10, unit_price: 80.0 },
      { description: 'Backend APIs', quantity: 5, unit_price: 100.0 },
    ],
    is_draft: false,
  };
  const result = CreateInvoiceSchema.safeParse(payload);
  assert.equal(result.success, true);
});

test('CreateInvoiceSchema rejects invalid email', () => {
  const payload = {
    customer_name: 'Bob Smith',
    customer_email: 'not-an-email',
    description: 'Design',
    currency: 'USD',
    issue_date: '2026-10-17',
    due_date: '2026-10-31',
    items: [{ description: 'Work', quantity: 1, unit_price: 100.0 }],
  };
  const result = CreateInvoiceSchema.safeParse(payload);
  assert.equal(result.success, false);
});

test('Database creates customer and invoice with decimal precision', async () => {
  const invoice = await db.createInvoice({
    customer_name: 'Test Customer Alpha',
    customer_email: 'alpha@example-test.com',
    description: 'Software Architecture Audit',
    currency: 'USD',
    issue_date: '2026-10-17',
    due_date: '2026-10-24',
    notes: 'Pay via PayPal Sandbox',
    items: [
      { description: 'Database audit', quantity: 2.5, unit_price: 200.0 }, // 500
      { description: 'Security scan', quantity: 1, unit_price: 250.0 }, // 250
    ],
    is_draft: false,
  });

  assert.equal(invoice.customer_name, 'Test Customer Alpha');
  assert.equal(invoice.total_amount, 750.0);
  assert.equal(invoice.status, 'created');
  assert.ok(invoice.invoice_number.startsWith('INV-'));

  await db.deleteTestFixture(invoice.id);
});

test('Draft invoice can be edited, but non-draft cannot be modified silently', async () => {
  const draft = await db.createInvoice({
    customer_name: 'Draft Client',
    customer_email: 'draft@client.com',
    description: 'Initial draft proposal',
    currency: 'USD',
    issue_date: '2026-10-17',
    due_date: '2026-10-31',
    items: [{ description: 'Draft item', quantity: 1, unit_price: 100 }],
    is_draft: true,
  });

  assert.equal(draft.status, 'draft');

  // Updating the draft should succeed
  const updated = await db.updateDraftInvoice(draft.id, {
    description: 'Updated draft proposal',
    items: [{ description: 'Draft item expanded', quantity: 2, unit_price: 150 }],
  });
  assert.equal(updated.description, 'Updated draft proposal');
  assert.equal(updated.total_amount, 300.0);

  // Transition to paid
  await db.recordVerifiedPayment({
    invoice_id: draft.id,
    paypal_capture_id: `cap-test-${Date.now()}`,
    amount: 300.0,
    currency: 'USD',
    status: 'COMPLETED',
  });

  // Attempting to edit after paid must throw error
  await assert.rejects(
    async () => {
      await db.updateDraftInvoice(draft.id, { description: 'Malicious modification' });
    },
    /Cannot edit invoice/
  );

  await db.deleteTestFixture(draft.id);
});

test('Payment verification is idempotent and does not double-count', async () => {
  const inv = await db.createInvoice({
    customer_name: 'Idempotency Test User',
    customer_email: 'idempotent@test.com',
    description: 'Consulting',
    currency: 'USD',
    issue_date: '2026-10-17',
    due_date: '2026-10-30',
    items: [{ description: 'Consulting hour', quantity: 1, unit_price: 200.0 }],
    is_draft: false,
  });

  const captureId = `cap-unique-${Date.now()}`;

  // First capture
  const payment1 = await db.recordVerifiedPayment({
    invoice_id: inv.id,
    paypal_capture_id: captureId,
    amount: 200.0,
    currency: 'USD',
    status: 'COMPLETED',
  });
  assert.equal(payment1.amount, 200.0);

  // Second capture with same capture ID (simulating duplicate webhook / retry)
  const payment2 = await db.recordVerifiedPayment({
    invoice_id: inv.id,
    paypal_capture_id: captureId,
    amount: 200.0,
    currency: 'USD',
    status: 'COMPLETED',
  });
  assert.equal(payment2.id, payment1.id);

  await db.deleteTestFixture(inv.id);
});

test('PayPal service handles missing credentials safely', async () => {
  // Even if credentials are not configured, status check doesn't crash
  const status = await paypal.getStatus();
  assert.equal(typeof status.isConfigured, 'boolean');
  assert.equal(typeof status.reachable, 'boolean');
  assert.equal(typeof status.baseUrl, 'string');
});

test('Gemini invoice prompt parser handles extraction without fabricating emails', { timeout: 25000 }, async () => {
  const result = await gemini.parseInvoicePrompt('Create an invoice for Vikram Patel for 300 dollars');
  assert.ok(result.customer_name);
  assert.equal(result.currency, 'USD');
  // Never fabricate customer email
  assert.equal(result.customer_email, null);
});

// ==========================================
// BUG 1: Date Validation Tests
// ==========================================
test('Bug 1: CreateInvoiceSchema rejects due date earlier than issue date', () => {
  const invalid = {
    customer_name: 'Test Customer',
    customer_email: 'test@example.com',
    description: 'Services',
    currency: 'USD',
    issue_date: '2026-10-29',
    due_date: '2026-10-28', // Earlier than issue date
    items: [{ description: 'Work', quantity: 1, unit_price: 100 }],
  };
  const result = CreateInvoiceSchema.safeParse(invalid);
  assert.equal(result.success, false);
  const issues = (result as any).error.issues;
  assert.ok(issues.some((i: any) => i.message.includes('Due date cannot be earlier than issue date.')));
});

test('Bug 1: CreateInvoiceSchema accepts equal issue and due dates', () => {
  const valid = {
    customer_name: 'Test Customer',
    customer_email: 'test@example.com',
    description: 'Services',
    currency: 'USD',
    issue_date: '2026-10-29',
    due_date: '2026-10-29', // Same day
    items: [{ description: 'Work', quantity: 1, unit_price: 100 }],
  };
  const result = CreateInvoiceSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test('Bug 1: Database createInvoice rejects due date earlier than issue date', async () => {
  await assert.rejects(
    async () => {
      await db.createInvoice({
        customer_name: 'Date Test User',
        customer_email: 'datetest@example.com',
        description: 'Testing dates',
        currency: 'USD',
        issue_date: '2026-10-29',
        due_date: '2026-10-20',
        items: [{ description: 'Task', quantity: 1, unit_price: 50 }],
      });
    },
    /Due date cannot be earlier than issue date\./
  );
});

test('Bug 1: Database updateDraftInvoice rejects due date earlier than issue date', async () => {
  const draft = await db.createInvoice({
    customer_name: 'Draft Date User',
    customer_email: 'draftdate@example.com',
    description: 'Testing draft dates',
    currency: 'USD',
    issue_date: '2026-10-29',
    due_date: '2026-11-10',
    items: [{ description: 'Task', quantity: 1, unit_price: 50 }],
    is_draft: true,
  });

  await assert.rejects(
    async () => {
      await db.updateDraftInvoice(draft.id, {
        due_date: '2026-10-25', // Earlier than issue_date (2026-10-29)
      });
    },
    /Due date cannot be earlier than issue date\./
  );

  await db.deleteTestFixture(draft.id);
});

// ==========================================
// BUG 2: Overdue Eligibility & Calculations
// ==========================================
test('Bug 2: Created invoice without payment link and past due date remains Created and not overdue', () => {
  const inv = {
    status: 'created',
    due_date: '2026-10-01', // in past
    payment_url: null,
    paypal_order_id: null,
  };
  assert.equal(isInvoiceOverdue(inv, '2026-10-29'), false);
  assert.equal(getEffectiveInvoiceStatus(inv as any, '2026-10-29'), 'created');
});

test('Bug 2: Sent invoice with payment link and past due date is overdue', () => {
  const inv = {
    status: 'sent',
    due_date: '2026-10-01', // in past
    payment_url: 'https://sandbox.paypal.com/checkout?token=123',
    paypal_order_id: '123',
  };
  assert.equal(isInvoiceOverdue(inv, '2026-10-29'), true);
  assert.equal(getEffectiveInvoiceStatus(inv as any, '2026-10-29'), 'overdue');
});

test('Bug 2: Sent invoice with payment link and future due date is not overdue', () => {
  const inv = {
    status: 'sent',
    due_date: '2026-11-15', // in future
    payment_url: 'https://sandbox.paypal.com/checkout?token=123',
    paypal_order_id: '123',
  };
  assert.equal(isInvoiceOverdue(inv, '2026-10-29'), false);
  assert.equal(getEffectiveInvoiceStatus(inv as any, '2026-10-29'), 'sent');
});

test('Bug 2: Paid invoice with past due date is never overdue', () => {
  const inv = {
    status: 'paid',
    due_date: '2026-09-01',
    payment_url: 'https://sandbox.paypal.com/checkout?token=123',
    paypal_order_id: '123',
  };
  assert.equal(isInvoiceOverdue(inv, '2026-10-29'), false);
  assert.equal(getEffectiveInvoiceStatus(inv as any, '2026-10-29'), 'paid');
});

test('Bug 2: Invoice due today is not overdue', () => {
  const inv = {
    status: 'sent',
    due_date: '2026-10-29',
    payment_url: 'https://sandbox.paypal.com/checkout?token=123',
    paypal_order_id: '123',
  };
  assert.equal(isInvoiceOverdue(inv, '2026-10-29'), false);
});

test('Bug 2: Dashboard metrics overdue count matches overdue filter count', async () => {
  const metrics = await db.getDashboardMetrics();
  const overdueInvoices = await db.getInvoices({ status: 'overdue' });
  assert.equal(metrics.overdueCount, overdueInvoices.length);
});

// ==========================================
// BUG 4 & 5: Payment Processing & Link Status Transitions
// ==========================================
test('Bug 5: Payment link generation transitions draft and created invoices to sent status', async () => {
  // 1. Saved as draft
  const draft = await db.createInvoice({
    customer_name: 'Transition Draft Customer Temp',
    customer_email: 'tdrafttemp@test.com',
    description: 'Transition test',
    currency: 'USD',
    issue_date: '2026-10-29',
    due_date: '2026-11-05',
    items: [{ description: 'Item 1', quantity: 1, unit_price: 120 }],
    is_draft: true,
  });
  assert.equal(draft.status, 'draft');

  const draftOrderId = `ORDER-DRAFT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const afterDraftLink = await db.updateInvoicePayPalInfo(draft.id, {
    paypal_order_id: draftOrderId,
    payment_url: `https://sandbox.paypal.com/checkout?token=${draftOrderId}`,
    status: 'sent',
  });
  assert.equal(afterDraftLink.status, 'sent');

  // 2. Created and issued without link
  const created = await db.createInvoice({
    customer_name: 'Transition Created Customer Temp',
    customer_email: 'tcreatedtemp@test.com',
    description: 'Transition test 2',
    currency: 'USD',
    issue_date: '2026-10-29',
    due_date: '2026-11-05',
    items: [{ description: 'Item 2', quantity: 1, unit_price: 180 }],
    is_draft: false,
  });
  assert.equal(created.status, 'created');

  const createdOrderId = `ORDER-CREATED-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const afterCreatedLink = await db.updateInvoicePayPalInfo(created.id, {
    paypal_order_id: createdOrderId,
    payment_url: `https://sandbox.paypal.com/checkout?token=${createdOrderId}`,
    status: 'sent',
  });
  assert.equal(afterCreatedLink.status, 'sent');

  await db.deleteTestFixture(draft.id);
  await db.deleteTestFixture(created.id);
});

test('Bug 4: recordVerifiedPayment rejects mismatched currency or amount and non-COMPLETED status', async () => {
  const inv = await db.createInvoice({
    customer_name: 'Validation Payment Customer',
    customer_email: 'vpc@test.com',
    description: 'Payment safety test',
    currency: 'USD',
    issue_date: '2026-10-29',
    due_date: '2026-11-10',
    items: [{ description: 'Audit', quantity: 1, unit_price: 250 }],
    is_draft: false,
  });

  // Mismatched currency
  await assert.rejects(
    async () => {
      await db.recordVerifiedPayment({
        invoice_id: inv.id,
        paypal_capture_id: `cap-err-curr-${Date.now()}`,
        amount: 250.0,
        currency: 'EUR', // Mismatched currency
        status: 'COMPLETED',
      });
    },
    /Payment currency/
  );

  // Mismatched amount
  await assert.rejects(
    async () => {
      await db.recordVerifiedPayment({
        invoice_id: inv.id,
        paypal_capture_id: `cap-err-amt-${Date.now()}`,
        amount: 50.0, // Expected 250.0
        currency: 'USD',
        status: 'COMPLETED',
      });
    },
    /Payment amount/
  );

  // Incomplete status
  await assert.rejects(
    async () => {
      await db.recordVerifiedPayment({
        invoice_id: inv.id,
        paypal_capture_id: `cap-err-stat-${Date.now()}`,
        amount: 250.0,
        currency: 'USD',
        status: 'PENDING',
      });
    },
    /Only COMPLETED captures can be recorded/
  );

  await db.deleteTestFixture(inv.id);
});

// ==========================================
// BUG 6 & 7: Gemini Extraction & Email/Description Preservation
// ==========================================
test('Bug 6 & 7: Gemini parser extracts email in parentheses and preserves specific description', { timeout: 25000 }, async () => {
  const prompt =
    'Create an invoice for Aman Sharma (aman.sharma@example.com) for 450 US dollars for React dashboard development and API integration, due 7 days from today.';
  const result = await gemini.parseInvoicePrompt(prompt);

  // Email preserved
  assert.equal(result.customer_email, 'aman.sharma@example.com');
  assert.equal(result.customer_name, 'Aman Sharma');

  // Specific description preserved
  assert.ok(
    result.description.toLowerCase().includes('react dashboard development') ||
      result.description.toLowerCase().includes('api integration')
  );
  assert.ok(!result.description.includes('Consulting & Development Services'));
  assert.ok(result.items.length > 0);
  assert.ok(
    result.items[0].description.toLowerCase().includes('react dashboard development') ||
      result.items[0].description.toLowerCase().includes('api integration')
  );
});

test('Bug 6 & 7: Gemini parser extracts email in sentence text and preserves mobile app description', { timeout: 25000 }, async () => {
  const prompt =
    'Create an invoice for Neha Kapoor email neha.kapoor@example.com for 500 dollars for Mobile application development and testing, due in 14 days';
  const result = await gemini.parseInvoicePrompt(prompt);

  assert.equal(result.customer_email, 'neha.kapoor@example.com');
  assert.ok(result.customer_name.toLowerCase().includes('neha'));
  assert.ok(result.description.toLowerCase().includes('mobile application development'));
});

test('Bug 7: Gemini parser preserves website redesign description', { timeout: 25000 }, async () => {
  const prompt =
    'Invoice client Acme Corp for $800 for Website redesign and performance optimization due next month';
  const result = await gemini.parseInvoicePrompt(prompt);
  assert.ok(result.description.toLowerCase().includes('website redesign'));
});

test('Bug 7: Gemini parser preserves database migration description', { timeout: 25000 }, async () => {
  const prompt =
    'Invoice for David Miller for 600 USD for Database migration and API maintenance, due 7 days from today';
  const result = await gemini.parseInvoicePrompt(prompt);
  assert.ok(result.description.toLowerCase().includes('database migration'));
});

test('Clean up database connections', async () => {
  await db.close();
});
