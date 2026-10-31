import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { gemini } from '../server/gemini.ts';
import { formatCurrency, detectCurrencyFromText, SUPPORTED_CURRENCIES } from '../src/utils/currency.ts';
import { db } from '../server/db.ts';

describe('PayPilot Currency Extraction, Formatting & Integrity Tests', () => {
  before(async () => {
    await db.ensureInitialized();
  });

  after(async () => {
    if (db.pool) {
      await db.pool.end().catch(() => {});
    }
    setTimeout(() => process.exit(0), 100);
  });

  test('1. detectCurrencyFromText correctly detects 7 supported currencies and ignores INR', () => {
    assert.equal(
      detectCurrencyFromText('Create an invoice for Rahul Sharma for 450 Euro for React dashboard development'),
      'EUR'
    );
    assert.equal(
      detectCurrencyFromText('Create an invoice for Aman for €350 due next week'),
      'EUR'
    );
    assert.equal(
      detectCurrencyFromText('Charge 250 GBP for security audit'),
      'GBP'
    );
    assert.equal(
      detectCurrencyFromText('Bill £800 for UX overhaul'),
      'GBP'
    );
    assert.equal(
      detectCurrencyFromText('Invoice 320 CAD for Canadian logistics consultancy'),
      'CAD'
    );
    assert.equal(
      detectCurrencyFromText('Invoice 400 AUD for Australian market expansion'),
      'AUD'
    );
    assert.equal(
      detectCurrencyFromText('Bill 50000 JPY for localization'),
      'JPY'
    );
    assert.equal(
      detectCurrencyFromText('Invoice 600 CHF for Swiss financial audit'),
      'CHF'
    );
    assert.equal(
      detectCurrencyFromText('Invoice $450 USD for logo design'),
      'USD'
    );
    // INR should NOT be recognized as a supported currency
    assert.equal(
      detectCurrencyFromText('Bill David Vance 15,000 INR for database tuning'),
      null
    );
    assert.equal(
      detectCurrencyFromText('No currency mentioned here for consulting'),
      null
    );
  });

  test('2. gemini.detectCurrencyFromPrompt mirrors server-side deterministic detection for 7 currencies', () => {
    const euroPrompt =
      'Create an invoice for Rahul Sharma (rahul.sharma@example.com) for 450 Euro for React dashboard development and API integration, due 7 days from today.';
    assert.equal(gemini.detectCurrencyFromPrompt(euroPrompt), 'EUR');

    const gbpPrompt = 'Create an invoice for Oliver Smith for 1200 Pounds for security testing';
    assert.equal(gemini.detectCurrencyFromPrompt(gbpPrompt), 'GBP');

    const cadPrompt = 'Create an invoice for Marcus Vance for 750 CAD for cloud infrastructure';
    assert.equal(gemini.detectCurrencyFromPrompt(cadPrompt), 'CAD');

    const chfPrompt = 'Create an invoice for Zurich Client for 900 CHF for compliance report';
    assert.equal(gemini.detectCurrencyFromPrompt(chfPrompt), 'CHF');

    // INR should not be recognized
    const inrPrompt = 'Create an invoice for Priya Patel for 25000 Rupees for cloud architecture';
    assert.equal(gemini.detectCurrencyFromPrompt(inrPrompt), null);
  });

  test('3. parseInvoicePrompt parses Priya Sharma prompt with exact multi-line items and 14 days due date', async () => {
    const prompt =
      'Create an invoice for Priya Sharma (priya.sharma@example.com) for mobile application development services. Include iOS app development, Android app development, and QA testing. Charge 2 units of iOS development at $250 per unit, 1 unit of Android development at $175, and 1 unit of QA testing at $75. Set the issue date to today and due date to 14 days from today.';
    const draft = await gemini.parseInvoicePrompt(prompt);

    assert.equal(draft.customer_name, 'Priya Sharma');
    assert.equal(draft.customer_email, 'priya.sharma@example.com');
    assert.equal(draft.description, 'mobile application development services');
    assert.equal(draft.currency, 'USD');

    // Due date calculation check (14 days from issue_date)
    const issueD = new Date(draft.issue_date);
    const dueD = new Date(draft.due_date);
    const diffDays = Math.round((dueD.getTime() - issueD.getTime()) / (1000 * 60 * 60 * 24));
    assert.equal(diffDays, 14, `Due date must be exactly 14 days after issue date, got ${diffDays} days`);

    // Multi-item checks
    assert.equal(draft.items.length, 3, `Expected exactly 3 line items, got ${draft.items.length}`);

    const item1 = draft.items.find((it) => it.description.toLowerCase().includes('ios'));
    assert.ok(item1, 'iOS development item must be present');
    assert.equal(item1?.quantity, 2);
    assert.equal(item1?.unit_price, 250);
    assert.equal(item1?.line_total, 500);

    const item2 = draft.items.find((it) => it.description.toLowerCase().includes('android'));
    assert.ok(item2, 'Android development item must be present');
    assert.equal(item2?.quantity, 1);
    assert.equal(item2?.unit_price, 175);
    assert.equal(item2?.line_total, 175);

    const item3 = draft.items.find((it) => it.description.toLowerCase().includes('qa'));
    assert.ok(item3, 'QA testing item must be present');
    assert.equal(item3?.quantity, 1);
    assert.equal(item3?.unit_price, 75);
    assert.equal(item3?.line_total, 75);

    const total = draft.items.reduce((s, it) => s + it.line_total, 0);
    assert.equal(total, 750, 'Total must equal $750.00');
  });

  test('4. parseInvoicePrompt parses 450 Euro prompt with EUR currency and exact amount without USD override', async () => {
    const prompt =
      'Create an invoice for Rahul Sharma (rahul.sharma@example.com) for 450 Euro for React dashboard development and API integration, due 7 days from today.';
    const draft = await gemini.parseInvoicePrompt(prompt);

    assert.equal(draft.currency, 'EUR', 'Currency must be EUR');
    assert.equal(draft.customer_name, 'Rahul Sharma');
    assert.equal(draft.customer_email, 'rahul.sharma@example.com');
    assert.equal(draft.description, 'React dashboard development and API integration');
    assert.ok(draft.items.length >= 1);
    const total = draft.items.reduce((s, it) => s + it.line_total, 0);
    assert.equal(total, 450, 'Total must equal 450 EUR without unauthorized conversion');
  });

  test('5. formatCurrency formats 7 supported currencies accurately without hardcoded dollar symbols', () => {
    const eurFormatted = formatCurrency(450, 'EUR');
    assert.ok(
      eurFormatted.includes('€') || eurFormatted.includes('EUR'),
      `EUR formatting must include € or EUR, got: ${eurFormatted}`
    );
    assert.ok(eurFormatted.includes('450.00'), `EUR formatting must include 450.00, got: ${eurFormatted}`);
    assert.ok(!eurFormatted.startsWith('$'), `EUR formatting must not start with $, got: ${eurFormatted}`);

    const gbpFormatted = formatCurrency(250, 'GBP');
    assert.ok(
      gbpFormatted.includes('£') || gbpFormatted.includes('GBP'),
      `GBP formatting must include £ or GBP, got: ${gbpFormatted}`
    );

    const cadFormatted = formatCurrency(300, 'CAD');
    assert.ok(
      cadFormatted.includes('CA$') || cadFormatted.includes('CAD') || cadFormatted.includes('$'),
      `CAD formatting must include CA$ or CAD, got: ${cadFormatted}`
    );

    const chfFormatted = formatCurrency(500, 'CHF');
    assert.ok(
      chfFormatted.includes('CHF'),
      `CHF formatting must include CHF, got: ${chfFormatted}`
    );

    const jpyFormatted = formatCurrency(12000, 'JPY');
    assert.ok(
      jpyFormatted.includes('¥') || jpyFormatted.includes('JPY'),
      `JPY formatting must include ¥ or JPY, got: ${jpyFormatted}`
    );

    const usdFormatted = formatCurrency(100, 'USD');
    assert.equal(usdFormatted, '$100.00');
  });

  test('6. Baseline 15 invoices exist sequentially from INV-2026-001 to INV-2026-015', async () => {
    const invoices = await db.getInvoices();
    assert.ok(invoices.length >= 15, `Expected at least 15 invoices, found ${invoices.length}`);

    const base15 = invoices.filter((i) => i.invoice_number <= 'INV-2026-015');
    assert.equal(base15.length, 15, 'Must contain all 15 baseline invoices');

    const sorted = [...base15].sort((a, b) => a.invoice_number.localeCompare(b.invoice_number));
    for (let i = 0; i < 15; i++) {
      const expectedNum = `INV-2026-${String(i + 1).padStart(3, '0')}`;
      assert.equal(sorted[i].invoice_number, expectedNum, `Invoice index ${i} should be ${expectedNum}`);
    }
  });

  test('7. The genuine PayPal captures on INV-2026-008, 010, and 013 remain intact in database', async () => {
    const invoices = await db.getInvoices();

    const inv8 = invoices.find((i) => i.invoice_number === 'INV-2026-008');
    const inv10 = invoices.find((i) => i.invoice_number === 'INV-2026-010');
    const inv13 = invoices.find((i) => i.invoice_number === 'INV-2026-013');

    assert.ok(inv8 && inv8.status === 'paid', 'INV-2026-008 must be paid');
    assert.ok(inv10 && inv10.status === 'paid', 'INV-2026-010 must be paid');
    assert.ok(inv13 && inv13.status === 'paid', 'INV-2026-013 must be paid');

    const p8 = await db.getPaymentByInvoiceId(inv8!.id);
    const p10 = await db.getPaymentByInvoiceId(inv10!.id);
    const p13 = await db.getPaymentByInvoiceId(inv13!.id);

    assert.equal(p8?.paypal_capture_id, '1NP51634CP163571V');
    assert.equal(p10?.paypal_capture_id, '19T03790K90967049');
    assert.equal(p13?.paypal_capture_id, '87069146H1400201S');
  });

  test('8. Supported currencies configuration contains EXACTLY the 7 supported currencies without INR', () => {
    assert.equal(SUPPORTED_CURRENCIES.length, 7, `Expected exactly 7 supported currencies, got ${SUPPORTED_CURRENCIES.length}`);
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
    assert.deepEqual(codes.sort(), ['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'JPY', 'USD'].sort());
    assert.ok(!codes.includes('INR'), 'INR must NOT be present in supported currencies');
  });
});
