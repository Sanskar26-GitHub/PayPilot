import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../server/db.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test('Save as Draft workflow creates invoice in draft status and retrieves by returned UUID', async () => {
  await db.ensureInitialized();

  const draftPayload = {
    customer_name: 'Acme Draft Corp',
    customer_email: 'billing@acmedraft.com',
    description: 'Q4 Consulting - Draft Phase',
    currency: 'USD',
    issue_date: '2026-10-18',
    due_date: '2026-11-01',
    notes: 'Draft proposal - subject to client approval',
    items: [
      { description: 'Initial Assessment', quantity: 1, unit_price: 350.0 },
      { description: 'Cloud Architecture Spec', quantity: 2, unit_price: 250.0 },
    ],
    is_draft: true,
  };

  // 1. Create invoice via "Save as Draft"
  const createdDraft = await db.createInvoice(draftPayload);

  assert.ok(createdDraft.id, 'Created invoice must have an id');
  assert.match(createdDraft.id, UUID_REGEX, 'Returned id must be a valid UUID');
  assert.equal(createdDraft.status, 'draft', 'Status must be "draft"');
  assert.equal(createdDraft.total_amount, 850.0, 'Total amount must equal 350 + 2*250');
  assert.equal(createdDraft.customer_name, 'Acme Draft Corp');
  assert.equal(createdDraft.customer_email, 'billing@acmedraft.com');

  // 2. Retrieve invoice by returned UUID
  const retrieved = await db.getInvoiceById(createdDraft.id);
  assert.ok(retrieved, 'Invoice must be found by returned UUID');
  assert.equal(retrieved.id, createdDraft.id);
  assert.equal(retrieved.invoice_number, createdDraft.invoice_number);
  assert.equal(retrieved.status, 'draft');
  assert.equal(retrieved.total_amount, 850.0);
  assert.equal(retrieved.customer_name, 'Acme Draft Corp');
  assert.ok(Array.isArray(retrieved.items), 'Items array must be returned');
  assert.equal(retrieved.items.length, 2, 'Must have exactly 2 line items');

  // Clean up fixture
  await db.deleteTestFixture(createdDraft.id);
});

test('Save and Issue Invoice workflow creates active invoice and retrieves by returned UUID', async () => {
  await db.ensureInitialized();

  const issuePayload = {
    customer_name: 'Zenith Innovations',
    customer_email: 'accounts@zenithinnovations.org',
    description: 'Production API Development & Integration',
    currency: 'USD',
    issue_date: '2026-10-18',
    due_date: '2026-11-15',
    notes: 'Net 30. Payment via PayPal Sandbox.',
    items: [
      { description: 'API Gateway Implementation', quantity: 3, unit_price: 400.0 },
      { description: 'Automated Regression Suite', quantity: 1, unit_price: 600.0 },
    ],
    is_draft: false,
  };

  // 1. Create invoice via "Save and Issue Invoice" (Create & Issue)
  const createdIssued = await db.createInvoice(issuePayload);

  assert.ok(createdIssued.id, 'Created invoice must have an id');
  assert.match(createdIssued.id, UUID_REGEX, 'Returned id must be a valid UUID');
  assert.equal(createdIssued.status, 'created', 'Status must be "created"');
  assert.equal(createdIssued.total_amount, 1800.0, 'Total must equal 3*400 + 600 = 1800');
  assert.equal(createdIssued.customer_name, 'Zenith Innovations');

  // 2. Retrieve invoice by returned UUID
  const retrieved = await db.getInvoiceById(createdIssued.id);
  assert.ok(retrieved, 'Invoice must be retrieved by returned UUID');
  assert.equal(retrieved.id, createdIssued.id);
  assert.equal(retrieved.invoice_number, createdIssued.invoice_number);
  assert.equal(retrieved.status, 'created');
  assert.equal(retrieved.total_amount, 1800.0);
  assert.equal(retrieved.items?.length, 2);

  // Clean up fixture
  await db.deleteTestFixture(createdIssued.id);
});

test('Invoice can be retrieved by invoice_number as well as UUID without SQL syntax errors', async () => {
  await db.ensureInitialized();

  const invoice = await db.createInvoice({
    customer_name: 'Omni Retail Ltd',
    customer_email: 'finance@omniretail.com',
    description: 'E-commerce Checkout Migration',
    currency: 'USD',
    issue_date: '2026-10-18',
    due_date: '2026-10-25',
    items: [{ description: 'Checkout integration', quantity: 1, unit_price: 500.0 }],
    is_draft: false,
  });

  // Query by UUID
  const byUuid = await db.getInvoiceById(invoice.id);
  assert.ok(byUuid, 'Must find invoice by UUID');
  assert.equal(byUuid.id, invoice.id);

  // Query by invoice_number (e.g. "INV-2026-xxx")
  const byNumber = await db.getInvoiceById(invoice.invoice_number);
  assert.ok(byNumber, 'Must find invoice by invoice_number without uuid cast errors');
  assert.equal(byNumber.id, invoice.id);
  assert.equal(byNumber.invoice_number, invoice.invoice_number);

  // Clean up fixture
  await db.deleteTestFixture(invoice.id);
});

test('Concurrent database health check / recheck does not tear down pool or break invoice retrieval', async () => {
  await db.ensureInitialized();

  const invoice = await db.createInvoice({
    customer_name: 'Concurrent Test Client',
    customer_email: 'concurrent@client.com',
    description: 'Concurrency and Refresh Resilience Test',
    currency: 'USD',
    issue_date: '2026-10-18',
    due_date: '2026-11-01',
    items: [{ description: 'Load testing service', quantity: 1, unit_price: 750.0 }],
    is_draft: false,
  });

  // Simulate concurrent requests happening on details page load / refresh:
  // 1. recheckConnection() triggered by integration status check
  // 2. getInvoiceById() called to load invoice details
  // 3. getDashboardMetrics() called to refresh parent stats
  const [status, retrieved, metrics] = await Promise.all([
    db.recheckConnection(),
    db.getInvoiceById(invoice.id),
    db.getDashboardMetrics(),
  ]);

  assert.ok(status.isConnected, 'Database should remain connected after recheck');
  assert.ok(retrieved, 'Invoice retrieval must succeed concurrently with recheck');
  assert.equal(retrieved.id, invoice.id);
  assert.equal(retrieved.customer_name, 'Concurrent Test Client');
  assert.ok(metrics.totalInvoicesCount > 0, 'Metrics should compute successfully');

  // Second retrieval simulating page refresh
  const refreshed = await db.getInvoiceById(invoice.id);
  assert.ok(refreshed, 'Invoice must still be retrievable on page refresh');
  assert.equal(refreshed.id, invoice.id);

  // Clean up fixture
  await db.deleteTestFixture(invoice.id);
});

test('Non-existent invoice id returns null cleanly without throwing database exceptions', async () => {
  await db.ensureInitialized();

  const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
  const result1 = await db.getInvoiceById(nonExistentUuid);
  assert.equal(result1, null, 'Non-existent UUID should return null');

  const nonExistentNumber = 'INV-9999-999';
  const result2 = await db.getInvoiceById(nonExistentNumber);
  assert.equal(result2, null, 'Non-existent invoice number should return null');

  const emptyString = '';
  const result3 = await db.getInvoiceById(emptyString);
  assert.equal(result3, null, 'Empty string should return null');
});

test('Clean up database connections', async () => {
  await db.close();
});
