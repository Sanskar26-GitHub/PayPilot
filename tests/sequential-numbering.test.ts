import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../server/db.ts';

test('1. Exactly 15 invoices exist in the database', async () => {
  await db.ensureInitialized();
  const invoices = await db.getInvoices();
  assert.equal(invoices.length, 15, 'Database must contain exactly 15 retained invoices');
});

test('2. Invoices run sequentially from INV-2026-001 through INV-2026-015 without gaps', async () => {
  await db.ensureInitialized();
  const pool = db.pool;
  assert.ok(pool, 'Database pool must be available');

  const res = await pool.query(`
    SELECT invoice_number, created_at, id
    FROM invoices
    ORDER BY invoice_number ASC
  `);

  const numbers = res.rows.map((r) => r.invoice_number);
  const expectedNumbers = Array.from({ length: 15 }, (_, i) => `INV-2026-${(i + 1).toString().padStart(3, '0')}`);

  assert.deepEqual(numbers, expectedNumbers, 'Invoice numbers must run sequentially from INV-2026-001 to INV-2026-015');
});

test('3. Invoice statuses and payment records remain intact', async () => {
  await db.ensureInitialized();
  const invoices = await db.getInvoices();

  const statusCounts = invoices.reduce<Record<string, number>>((acc, inv) => {
    acc[inv.status] = (acc[inv.status] || 0) + 1;
    return acc;
  }, {});

  // 3 draft, 7 created, 2 sent, 3 paid = 15 total
  assert.equal(statusCounts['paid'], 3, 'Must have exactly 3 paid invoices');
  assert.equal(statusCounts['sent'], 2, 'Must have exactly 2 sent invoices');
  assert.equal(statusCounts['created'], 7, 'Must have exactly 7 created invoices');
  assert.equal(statusCounts['draft'], 3, 'Must have exactly 3 draft invoices');
});

test('4. All three genuine PayPal payment captures remain associated with the correct invoices', async () => {
  await db.ensureInitialized();
  const pool = db.pool;
  assert.ok(pool, 'Database pool must be available');

  const res = await pool.query(`
    SELECT p.paypal_capture_id, p.amount, p.currency, p.status, i.invoice_number, c.name AS customer_name
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    JOIN customers c ON i.customer_id = c.id
    ORDER BY p.created_at ASC
  `);

  assert.equal(res.rows.length, 3, 'Must have exactly 3 verified payment records');

  const captureMap = new Map(res.rows.map((r) => [r.paypal_capture_id, r]));

  // Capture 1: 1NP51634CP163571V -> $5.00, Ankit Sharma, previously INV-012, now INV-2026-008
  const p1 = captureMap.get('1NP51634CP163571V');
  assert.ok(p1, 'Capture 1NP51634CP163571V must exist');
  assert.equal(p1.invoice_number, 'INV-2026-008');
  assert.equal(p1.customer_name, 'Ankit Sharma');
  assert.equal(parseFloat(p1.amount), 5.0);
  assert.equal(p1.status, 'COMPLETED');

  // Capture 2: 19T03790K90967049 -> $5.00, David Vance, previously INV-014, now INV-2026-010
  const p2 = captureMap.get('19T03790K90967049');
  assert.ok(p2, 'Capture 19T03790K90967049 must exist');
  assert.equal(p2.invoice_number, 'INV-2026-010');
  assert.equal(p2.customer_name, 'David Vance');
  assert.equal(parseFloat(p2.amount), 5.0);
  assert.equal(p2.status, 'COMPLETED');

  // Capture 3: 87069146H1400201S -> $250.00, Neha kapoor, previously INV-017, now INV-2026-013
  const p3 = captureMap.get('87069146H1400201S');
  assert.ok(p3, 'Capture 87069146H1400201S must exist');
  assert.equal(p3.invoice_number, 'INV-2026-013');
  assert.equal(p3.customer_name, 'Neha kapoor');
  assert.equal(parseFloat(p3.amount), 250.0);
  assert.equal(p3.status, 'COMPLETED');
});

test('5 & 6. Newly created invoices receive INV-2026-016 and INV-2026-017 sequentially', async () => {
  await db.ensureInitialized();

  // Create 16th invoice
  const inv16 = await db.createInvoice({
    customer_name: 'Sequential Verification Client 16',
    customer_email: 'seq16@test.com',
    description: '16th sequential invoice verification',
    currency: 'USD',
    issue_date: '2026-10-30',
    due_date: '2026-11-15',
    items: [{ description: 'Feature Development', quantity: 1, unit_price: 100.0 }],
    is_draft: false,
  });

  // Create 17th invoice
  const inv17 = await db.createInvoice({
    customer_name: 'Sequential Verification Client 17',
    customer_email: 'seq17@test.com',
    description: '17th sequential invoice verification',
    currency: 'USD',
    issue_date: '2026-10-30',
    due_date: '2026-11-15',
    items: [{ description: 'Quality Assurance', quantity: 1, unit_price: 150.0 }],
    is_draft: false,
  });

  try {
    assert.equal(inv16.invoice_number, 'INV-2026-016', 'Next newly created invoice must receive INV-2026-016');
    assert.equal(inv17.invoice_number, 'INV-2026-017', 'Subsequent invoice must receive INV-2026-017');
  } finally {
    // Clean up test fixtures so 15 baseline records remain untouched
    await db.deleteTestFixture(inv16.id);
    await db.deleteTestFixture(inv17.id);
  }
});

test('7. Concurrent invoice creation cannot produce duplicate numbers', async () => {
  await db.ensureInitialized();

  // Concurrently create 3 invoices
  const [c1, c2, c3] = await Promise.all([
    db.createInvoice({
      customer_name: 'Concurrent Client 1',
      customer_email: 'conc1@test.com',
      description: 'Concurrent Test 1',
      currency: 'USD',
      issue_date: '2026-10-30',
      due_date: '2026-11-20',
      items: [{ description: 'Task 1', quantity: 1, unit_price: 50.0 }],
      is_draft: true,
    }),
    db.createInvoice({
      customer_name: 'Concurrent Client 2',
      customer_email: 'conc2@test.com',
      description: 'Concurrent Test 2',
      currency: 'USD',
      issue_date: '2026-10-30',
      due_date: '2026-11-20',
      items: [{ description: 'Task 2', quantity: 1, unit_price: 50.0 }],
      is_draft: true,
    }),
    db.createInvoice({
      customer_name: 'Concurrent Client 3',
      customer_email: 'conc3@test.com',
      description: 'Concurrent Test 3',
      currency: 'USD',
      issue_date: '2026-10-30',
      due_date: '2026-11-20',
      items: [{ description: 'Task 3', quantity: 1, unit_price: 50.0 }],
      is_draft: true,
    }),
  ]);

  try {
    const nums = [c1.invoice_number, c2.invoice_number, c3.invoice_number];
    const uniqueNums = new Set(nums);
    assert.equal(uniqueNums.size, 3, 'All concurrent invoice numbers must be distinct');

    // Numbers must strictly increment
    const intNums = nums.map((n) => parseInt(n.split('-')[2], 10)).sort((a, b) => a - b);
    assert.equal(intNums[1], intNums[0] + 1);
    assert.equal(intNums[2], intNums[1] + 1);
  } finally {
    await db.deleteTestFixture(c1.id);
    await db.deleteTestFixture(c2.id);
    await db.deleteTestFixture(c3.id);
  }
});

test('8. Deleted invoices do not cause numbers to be reused', async () => {
  await db.ensureInitialized();

  // Create an invoice
  const tempInv = await db.createInvoice({
    customer_name: 'Delete Sequence Test',
    customer_email: 'deleteseq@test.com',
    description: 'Sequence gap test',
    currency: 'USD',
    issue_date: '2026-10-30',
    due_date: '2026-11-20',
    items: [{ description: 'Temp', quantity: 1, unit_price: 25.0 }],
    is_draft: true,
  });

  const allocatedNum = tempInv.invoice_number;
  const allocatedInt = parseInt(allocatedNum.split('-')[2], 10);

  // Permanently delete this draft
  await db.deleteInvoice(tempInv.id);

  // Create a subsequent invoice
  const nextInv = await db.createInvoice({
    customer_name: 'Subsequent Client',
    customer_email: 'subsequent@test.com',
    description: 'Subsequent test',
    currency: 'USD',
    issue_date: '2026-10-30',
    due_date: '2026-11-20',
    items: [{ description: 'Next item', quantity: 1, unit_price: 30.0 }],
    is_draft: false,
  });

  try {
    const nextInt = parseInt(nextInv.invoice_number.split('-')[2], 10);
    assert.ok(
      nextInt > allocatedInt,
      `Next invoice number (${nextInv.invoice_number}) must be strictly greater than deleted number (${allocatedNum}) and not reused`
    );
  } finally {
    await db.deleteTestFixture(nextInv.id);
  }
});

test('9. Database returns to exactly 15 baseline invoices after all test teardowns', async () => {
  await db.ensureInitialized();
  const invoices = await db.getInvoices();
  assert.equal(invoices.length, 15, 'Database must contain exactly 15 invoices after test teardown');
});

test('Clean up database connections', async () => {
  await db.close();
});
