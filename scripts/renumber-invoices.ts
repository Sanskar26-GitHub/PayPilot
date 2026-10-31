import { db } from '../server/db.ts';

interface InvoiceRow {
  id: string;
  invoice_number: string;
  created_at: Date;
  status: string;
  total_amount: string;
  customer_name: string;
}

async function runRenumbering() {
  await db.ensureInitialized();
  const pool = db.pool;
  if (!pool) {
    throw new Error('Supabase PostgreSQL pool is not available.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch current 15 invoices in deterministic order
    const res = await client.query(`
      SELECT i.id, i.invoice_number, i.created_at, i.status, i.total_amount, c.name AS customer_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at ASC, i.id ASC
    `);

    const invoices: InvoiceRow[] = res.rows;
    console.log(`Found ${invoices.length} invoices in database.`);

    if (invoices.length !== 15) {
      throw new Error(`Expected exactly 15 invoices, but found ${invoices.length}. Aborting migration.`);
    }

    const mapping: { id: string; oldNumber: string; newNumber: string; customer: string; status: string }[] = [];

    // Phase 1: Set temporary numbers to prevent unique constraint conflicts
    console.log('Phase 1: Setting temporary invoice numbers...');
    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      const tempNum = `TEMP-INV-${inv.id}`;
      await client.query('UPDATE invoices SET invoice_number = $1 WHERE id = $2', [tempNum, inv.id]);
    }

    // Phase 2: Set final sequential invoice numbers INV-2026-001 through INV-2026-015
    console.log('Phase 2: Assigning sequential invoice numbers INV-2026-001 to INV-2026-015...');
    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      const seq = i + 1;
      const newNum = `INV-2026-${seq.toString().padStart(3, '0')}`;
      mapping.push({
        id: inv.id,
        oldNumber: inv.invoice_number,
        newNumber: newNum,
        customer: inv.customer_name,
        status: inv.status,
      });

      await client.query('UPDATE invoices SET invoice_number = $1 WHERE id = $2', [newNum, inv.id]);

      // Phase 3: Update activity logs referencing this invoice
      await client.query(
        `UPDATE activity_logs 
         SET description = REPLACE(description, $1, $2)
         WHERE invoice_id = $3 AND description LIKE '%' || $1 || '%'`,
        [inv.invoice_number, newNum, inv.id]
      );

      await client.query(
        `UPDATE activity_logs 
         SET metadata = jsonb_set(metadata, '{invoice_number}', to_jsonb($1::text))
         WHERE invoice_id = $2 AND metadata ? 'invoice_number'`,
        [newNum, inv.id]
      );
    }

    // Phase 4: Create and initialize persistent PostgreSQL sequence for future invoice creation
    console.log('Phase 4: Configuring persistent invoice_number_seq starting at 16...');
    await client.query('CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 16 INCREMENT BY 1');
    await client.query("SELECT setval('invoice_number_seq', 15, true)");

    await client.query('COMMIT');

    console.log('Renumbering transaction committed successfully!');
    console.log('=== RENUMBERING MAPPING REPORT ===');
    console.table(mapping);

    // Verify nextval produces 16
    const nextValRes = await client.query("SELECT nextval('invoice_number_seq') AS num");
    console.log(`Verified test nextval: ${nextValRes.rows[0].num}`);
    // Reset back to 15 so next created invoice receives 16
    await client.query("SELECT setval('invoice_number_seq', 15, true)");
    console.log("Reset sequence to 15 so next creation receives INV-2026-016.");

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Renumbering failed, transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
    await db.close();
  }
}

runRenumbering().catch((err) => {
  console.error(err);
  process.exit(1);
});
