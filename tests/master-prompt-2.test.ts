import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../server/db.ts';

test('MP2 Requirement 1: Reading metrics, invoices, and customers NEVER generates an invoice', async () => {
  await db.ensureInitialized();

  const countBefore = (await db.getInvoices()).length;

  // Simulate dashboard load & metrics fetch
  await db.getDashboardMetrics();
  await db.getInvoices();
  await db.getCustomers();
  await db.getActivityLogs(20);
  await db.recheckConnection();

  const countAfter = (await db.getInvoices()).length;
  assert.equal(
    countAfter,
    countBefore,
    'Reading metrics, invoices, or activity logs must never create, seed, or duplicate any invoice'
  );
});

test('MP2 Requirement 2: Add Customer creates registered customer and handles idempotency', async () => {
  await db.ensureInitialized();

  const testEmail = `corp_${Date.now()}@acme-enterprises.test`;
  const testName = 'Acme Global Ventures';

  const customer1 = await db.createCustomer(testName, testEmail);
  assert.ok(customer1.id, 'Created customer must have a valid ID');
  assert.equal(customer1.name, testName);
  assert.equal(customer1.email, testEmail);

  // Calling again with duplicate name or email returns existing without error or duplication
  const customer2 = await db.createCustomer(testName, testEmail);
  assert.equal(customer2.id, customer1.id, 'Duplicate customer creation must return existing record');

  // Verify customer appears in customer list
  const customers = await db.getCustomers();
  const found = customers.find((c) => c.id === customer1.id);
  assert.ok(found, 'Customer must be retrievable from getCustomers()');
  assert.equal(found.name, testName);
});

test('MP2 Requirement 3: Edit Invoice allows updating draft invoices and recalculates totals', async () => {
  await db.ensureInitialized();

  // Create a draft invoice fixture
  const draft = await db.createInvoice({
    customer_name: 'Edit Draft Client',
    customer_email: 'editdraft@test.com',
    description: 'Initial proposal for web portal',
    currency: 'USD',
    issue_date: '2026-10-30',
    due_date: '2026-11-15',
    notes: 'Draft note',
    items: [
      { description: 'Phase 1 Architecture', quantity: 1, unit_price: 200.0 },
    ],
    is_draft: true,
  });

  try {
    assert.equal(draft.status, 'draft');
    assert.equal(draft.total_amount, 200.0);

    // Edit invoice: add items, update description
    const updated = await db.updateInvoice(draft.id, {
      description: 'Expanded web portal and mobile responsive UI',
      notes: 'Updated terms: Net 15',
      items: [
        { description: 'Phase 1 Architecture', quantity: 1, unit_price: 200.0 },
        { description: 'Phase 2 Frontend Development', quantity: 2, unit_price: 150.0 },
      ],
    });

    assert.equal(updated.description, 'Expanded web portal and mobile responsive UI');
    assert.equal(updated.notes, 'Updated terms: Net 15');
    assert.equal(updated.total_amount, 500.0, 'Total should be recalculated to 200 + 300 = 500');
    assert.ok(updated.items && updated.items.length === 2);

    // Verify persistence after re-fetching from DB
    const fetchedAgain = await db.getInvoiceById(draft.id);
    assert.ok(fetchedAgain);
    assert.equal(fetchedAgain.total_amount, 500.0);
    assert.equal(fetchedAgain.description, 'Expanded web portal and mobile responsive UI');
  } finally {
    await db.deleteTestFixture(draft.id);
  }
});

test('MP2 Requirement 3: Editing issued invoice with active PayPal link invalidates link on amount change', async () => {
  await db.ensureInitialized();

  // Create an issued invoice
  const inv = await db.createInvoice({
    customer_name: 'PayPal Invalidation Client',
    customer_email: 'paypal_inv@test.com',
    description: 'Cloud consulting',
    currency: 'USD',
    issue_date: '2026-10-30',
    due_date: '2026-11-20',
    items: [{ description: 'Cloud Audit', quantity: 1, unit_price: 300.0 }],
    is_draft: false,
  });

  try {
    // Attach PayPal order & link
    const fakeOrderId = `ORDER-INVAL-${Date.now()}`;
    await db.updateInvoicePayPalInfo(inv.id, {
      paypal_order_id: fakeOrderId,
      payment_url: `https://sandbox.paypal.com/checkout?token=${fakeOrderId}`,
      status: 'sent',
    });

    const withLink = await db.getInvoiceById(inv.id);
    assert.ok(withLink?.payment_url);
    assert.equal(withLink?.status, 'sent');

    // Edit the invoice amount: changing unit_price from 300 to 450
    const updated = await db.updateInvoice(inv.id, {
      items: [{ description: 'Cloud Audit Expanded', quantity: 1, unit_price: 450.0 }],
    });

    assert.equal(updated.total_amount, 450.0);
    assert.equal(
      updated.payment_url,
      null,
      'PayPal checkout URL must be invalidated when invoice amount changes'
    );
    assert.equal(
      updated.paypal_order_id,
      null,
      'PayPal order ID must be cleared when invoice amount changes'
    );

    // Check activity logs for invalidation audit entry
    const logs = await db.getActivityLogs(10);
    const logFound = logs.find(
      (l) => l.invoice_id === inv.id && l.event_type === 'PAYMENT_LINK_INVALIDATED'
    );
    assert.ok(logFound, 'PAYMENT_LINK_INVALIDATED audit event must be logged');
  } finally {
    await db.deleteTestFixture(inv.id);
  }
});

test('MP2 Requirement 3: Edit is strictly forbidden on paid invoices', async () => {
  await db.ensureInitialized();

  const inv = await db.createInvoice({
    customer_name: 'Paid Guard Client',
    customer_email: 'paidguard@test.com',
    description: 'Security Review',
    currency: 'USD',
    issue_date: '2026-10-30',
    due_date: '2026-11-10',
    items: [{ description: 'Security Review', quantity: 1, unit_price: 100.0 }],
    is_draft: false,
  });

  try {
    // Record verified payment
    await db.recordVerifiedPayment({
      invoice_id: inv.id,
      paypal_capture_id: `cap-guard-${Date.now()}`,
      amount: 100.0,
      currency: 'USD',
      status: 'COMPLETED',
    });

    // Attempting to edit paid invoice must be rejected
    await assert.rejects(
      async () => {
        await db.updateInvoice(inv.id, { description: 'Tampered invoice' });
      },
      /Cannot edit invoice in 'paid' status/
    );
  } finally {
    await db.deleteTestFixture(inv.id);
  }
});

test('MP2 Requirement 4: Delete permanently deletes draft invoices and their items', async () => {
  await db.ensureInitialized();

  const draft = await db.createInvoice({
    customer_name: 'Disposable Draft Client',
    customer_email: 'disposable@test.com',
    description: 'Temporary Quote',
    currency: 'USD',
    issue_date: '2026-10-30',
    due_date: '2026-11-05',
    items: [{ description: 'Item 1', quantity: 1, unit_price: 75.0 }],
    is_draft: true,
  });

  const res = await db.deleteInvoice(draft.id);
  assert.equal(res.action, 'deleted');

  // Verify completely removed from database
  const check = await db.getInvoiceById(draft.id);
  assert.equal(check, null, 'Draft invoice must be permanently removed');
});

test('MP2 Requirement 4: Delete on issued unpaid invoice voids/cancels it instead of hard delete', async () => {
  await db.ensureInitialized();

  const inv = await db.createInvoice({
    customer_name: 'Issued Void Client',
    customer_email: 'issuedvoid@test.com',
    description: 'Service agreement',
    currency: 'USD',
    issue_date: '2026-10-30',
    due_date: '2026-11-12',
    items: [{ description: 'Consulting', quantity: 1, unit_price: 350.0 }],
    is_draft: false,
  });

  try {
    const res = await db.deleteInvoice(inv.id);
    assert.equal(res.action, 'voided');

    const check = await db.getInvoiceById(inv.id);
    assert.ok(check, 'Issued invoice must remain in DB for audit trail');
    assert.equal(check.status, 'cancelled', 'Status must be set to cancelled (voided)');
  } finally {
    await db.deleteTestFixture(inv.id);
  }
});

test('MP2 Requirement 4: Deletion is strictly blocked on paid invoices', async () => {
  await db.ensureInitialized();

  const inv = await db.createInvoice({
    customer_name: 'Paid Protected Client',
    customer_email: 'paidprotected@test.com',
    description: 'Production deploy',
    currency: 'USD',
    issue_date: '2026-10-30',
    due_date: '2026-11-08',
    items: [{ description: 'Deploy', quantity: 1, unit_price: 120.0 }],
    is_draft: false,
  });

  try {
    await db.recordVerifiedPayment({
      invoice_id: inv.id,
      paypal_capture_id: `cap-protect-${Date.now()}`,
      amount: 120.0,
      currency: 'USD',
      status: 'COMPLETED',
    });

    await assert.rejects(
      async () => {
        await db.deleteInvoice(inv.id);
      },
      /Paid invoices cannot be deleted/
    );
  } finally {
    await db.deleteTestFixture(inv.id);
  }
});

test('MP2 Absence of Limits: Creating 16th and subsequent invoices succeeds without limits or quotas', async () => {
  await db.ensureInitialized();

  const initialCount = (await db.getInvoices()).length;
  assert.equal(initialCount, 15, 'Initial baseline count is 15 retained test invoices');

  // Create a 16th invoice manually
  const sixteenthInvoice = await db.createInvoice({
    customer_name: 'Sixteenth Customer Alpha',
    customer_email: 'customer16@unlimited-growth.com',
    description: 'Unlimited capacity verification invoice',
    currency: 'USD',
    issue_date: '2026-10-30',
    due_date: '2026-11-20',
    items: [{ description: 'Scalability Audit', quantity: 1, unit_price: 999.0 }],
    is_draft: false,
  });

  assert.ok(sixteenthInvoice.id, '16th invoice must be created successfully');
  assert.equal(sixteenthInvoice.customer_name, 'Sixteenth Customer Alpha');

  const countAfter16 = (await db.getInvoices()).length;
  assert.equal(
    countAfter16,
    16,
    'There must be no hard quota or limit preventing 16th or subsequent invoices'
  );

  // Clean up fixture to keep the 15 baseline invoices pristine
  await db.deleteTestFixture(sixteenthInvoice.id);

  const countRestored = (await db.getInvoices()).length;
  assert.equal(countRestored, 15, 'Baseline 15 invoices maintained after test');
});

test('Clean up database connections', async () => {
  await db.close();
});
