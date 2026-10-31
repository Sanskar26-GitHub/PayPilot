import pg from 'pg';
import crypto from 'crypto';
import type {
  Customer,
  Invoice,
  InvoiceItem,
  Payment,
  ActivityLog,
  InvoiceStatus,
  DashboardMetrics,
} from './types.ts';
import { isInvoiceOverdue } from './types.ts';

const { Pool } = pg;

export interface DbStatus {
  isConfigured: boolean;
  isConnected: boolean;
  provider: 'supabase' | 'in-memory-fallback';
  databaseName?: string;
  host?: string;
  error?: string;
}

// In-Memory Database store for fallback/demo resilience when DATABASE_URL is not yet set
class MemoryDb {
  customers: Map<string, Customer> = new Map();
  invoices: Map<string, Invoice> = new Map();
  invoiceItems: Map<string, InvoiceItem[]> = new Map();
  payments: Map<string, Payment> = new Map();
  activityLogs: ActivityLog[] = [];

  constructor() {
    // In-memory store initializes empty to avoid creating unintended seed records
  }

  seedDemoData() {
    const cust1: Customer = {
      id: 'c1111111-1111-4111-a111-111111111111',
      name: 'Rahul Sharma',
      email: 'rahul.sharma@example.com',
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    };
    const cust2: Customer = {
      id: 'c2222222-2222-4222-a222-222222222222',
      name: 'Elena Rostova',
      email: 'elena@technovision.io',
      created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 28 * 86400000).toISOString(),
    };
    const cust3: Customer = {
      id: 'c3333333-3333-4333-a333-333333333333',
      name: 'David Vance',
      email: 'david.vance@apexcreative.co',
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    };

    this.customers.set(cust1.id, cust1);
    this.customers.set(cust2.id, cust2);
    this.customers.set(cust3.id, cust3);

    // Invoice 1: Paid invoice
    const inv1: Invoice = {
      id: 'i1111111-1111-4111-b111-111111111111',
      invoice_number: 'INV-2026-001',
      customer_id: cust1.id,
      customer_name: cust1.name,
      customer_email: cust1.email,
      description: 'Full-stack application development & API design',
      currency: 'USD',
      subtotal: 1500.0,
      total_amount: 1500.0,
      issue_date: '2026-09-20',
      due_date: '2026-10-04',
      notes: 'Thank you for your business. Net 14.',
      status: 'paid',
      paypal_invoice_id: null,
      paypal_order_id: '8XX1234567890123A',
      payment_url: 'https://www.sandbox.paypal.com/checkoutnow?token=8XX1234567890123A',
      created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    };
    this.invoices.set(inv1.id, inv1);
    this.invoiceItems.set(inv1.id, [
      {
        id: crypto.randomUUID(),
        invoice_id: inv1.id,
        description: 'Backend REST API architecture & Supabase integration',
        quantity: 1,
        unit_price: 900.0,
        line_total: 900.0,
        created_at: inv1.created_at,
      },
      {
        id: crypto.randomUUID(),
        invoice_id: inv1.id,
        description: 'Frontend React UI & PayPal Sandbox testing',
        quantity: 1,
        unit_price: 600.0,
        line_total: 600.0,
        created_at: inv1.created_at,
      },
    ]);
    const pay1: Payment = {
      id: crypto.randomUUID(),
      invoice_id: inv1.id,
      paypal_order_id: '8XX1234567890123A',
      paypal_capture_id: '4YY9876543210987B',
      amount: 1500.0,
      currency: 'USD',
      status: 'COMPLETED',
      verified_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    };
    this.payments.set(pay1.id, pay1);

    // Invoice 2: Sent / Pending invoice
    const inv2: Invoice = {
      id: 'i2222222-2222-4222-b222-222222222222',
      invoice_number: 'INV-2026-002',
      customer_id: cust2.id,
      customer_name: cust2.name,
      customer_email: cust2.email,
      description: 'UI/UX redesign & responsive component migration',
      currency: 'USD',
      subtotal: 850.0,
      total_amount: 850.0,
      issue_date: '2026-10-10',
      due_date: '2026-10-24',
      notes: 'Payment via PayPal sandbox.',
      status: 'sent',
      paypal_invoice_id: null,
      paypal_order_id: null,
      payment_url: null,
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    };
    this.invoices.set(inv2.id, inv2);
    this.invoiceItems.set(inv2.id, [
      {
        id: crypto.randomUUID(),
        invoice_id: inv2.id,
        description: 'Dashboard wireframes & design system overhaul',
        quantity: 1,
        unit_price: 850.0,
        line_total: 850.0,
        created_at: inv2.created_at,
      },
    ]);

    // Invoice 3: Overdue invoice
    const inv3: Invoice = {
      id: 'i3333333-3333-4333-b333-333333333333',
      invoice_number: 'INV-2026-003',
      customer_id: cust3.id,
      customer_name: cust3.name,
      customer_email: cust3.email,
      description: 'Performance optimization & database indexing audit',
      currency: 'USD',
      subtotal: 420.0,
      total_amount: 420.0,
      issue_date: '2026-09-15',
      due_date: '2026-09-30',
      notes: 'Please remit payment at your earliest convenience.',
      status: 'overdue',
      paypal_invoice_id: null,
      paypal_order_id: null,
      payment_url: null,
      created_at: new Date(Date.now() - 32 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 17 * 86400000).toISOString(),
    };
    this.invoices.set(inv3.id, inv3);
    this.invoiceItems.set(inv3.id, [
      {
        id: crypto.randomUUID(),
        invoice_id: inv3.id,
        description: 'Query latency optimization & index tuning',
        quantity: 3,
        unit_price: 140.0,
        line_total: 420.0,
        created_at: inv3.created_at,
      },
    ]);

    this.activityLogs.push(
      {
        id: crypto.randomUUID(),
        invoice_id: inv1.id,
        event_type: 'PAYMENT_VERIFIED',
        description: 'Verified PayPal Sandbox payment of $1,500.00 USD for INV-2026-001',
        metadata: {
          order_id: '8XX1234567890123A',
          capture_id: '4YY9876543210987B',
          amount: 1500.0,
        },
        created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      },
      {
        id: crypto.randomUUID(),
        invoice_id: inv2.id,
        event_type: 'INVOICE_SENT',
        description: 'Issued invoice INV-2026-002 to Elena Rostova ($850.00 USD)',
        metadata: { invoice_number: 'INV-2026-002', amount: 850.0 },
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
      {
        id: crypto.randomUUID(),
        invoice_id: inv3.id,
        event_type: 'STATUS_CHANGED',
        description: 'Invoice INV-2026-003 past due date (marked overdue)',
        metadata: { invoice_number: 'INV-2026-003', due_date: '2026-09-30' },
        created_at: new Date(Date.now() - 17 * 86400000).toISOString(),
      }
    );
  }
}

function parsePostgresConnectionString(connStr: string): {
  config: pg.PoolConfig;
  host?: string;
  dbName?: string;
} {
  const lastAt = connStr.lastIndexOf('@');
  const schemeMatch = connStr.match(/^postgres(?:ql)?:\/\//);
  if (lastAt !== -1 && schemeMatch) {
    const protoLength = schemeMatch[0].length;
    const authPart = connStr.substring(protoLength, lastAt);
    const hostPart = connStr.substring(lastAt + 1);

    const firstColon = authPart.indexOf(':');
    if (firstColon !== -1) {
      const user = decodeURIComponent(authPart.substring(0, firstColon));
      const password = decodeURIComponent(authPart.substring(firstColon + 1));

      const slashIdx = hostPart.indexOf('/');
      const hostPort = slashIdx !== -1 ? hostPart.substring(0, slashIdx) : hostPart;
      const rest = slashIdx !== -1 ? hostPart.substring(slashIdx + 1) : '';
      const [dbName] = rest.split('?');

      const [host, portStr] = hostPort.split(':');
      const port = portStr ? parseInt(portStr, 10) : 5432;

      return {
        config: {
          user,
          password,
          host,
          port,
          database: dbName || 'postgres',
          ssl: host.includes('localhost') ? false : { rejectUnauthorized: false },
          connectionTimeoutMillis: 5000,
        },
        host,
        dbName: dbName || 'postgres',
      };
    }
  }

  // Fallback to standard URL parsing
  let host: string | undefined;
  let dbName: string | undefined;
  try {
    const u = new URL(connStr);
    host = u.hostname;
    dbName = u.pathname.replace('/', '') || 'postgres';
  } catch (e) {
    // ignore
  }

  return {
    config: {
      connectionString: connStr,
      ssl: connStr.includes('localhost') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    },
    host,
    dbName,
  };
}

class DatabaseService {
  public pool: pg.Pool | null = null;
  private memory = new MemoryDb();
  private status: DbStatus = {
    isConfigured: false,
    isConnected: false,
    provider: 'in-memory-fallback',
  };
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.init();
  }

  public async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  public async recheckConnection(): Promise<DbStatus> {
    // Await any initialization currently in flight
    if (this.initPromise) {
      await this.initPromise;
    }

    // If we have an existing connected pool, ping it with SELECT 1!
    // Never destroy a healthy active pool.
    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      try {
        const ping = await this.pool.query('SELECT 1');
        if (ping.rowCount !== null) {
          this.status.error = undefined;
          return this.getStatus();
        }
      } catch (err: any) {
        console.warn('[PayPilot DB] Existing PostgreSQL pool ping failed, attempting reconnect:', err.message);
      }
    }

    // Only attempt reconnect if not currently connected or if ping failed
    this.initPromise = this.init();
    await this.initPromise;
    return this.getStatus();
  }

  private async init(): Promise<void> {
    const connStr = process.env.DATABASE_URL;
    if (!connStr || connStr.includes('MY_') || connStr.includes('user:password')) {
      this.status = {
        isConfigured: false,
        isConnected: true,
        provider: 'in-memory-fallback',
        databaseName: 'in_memory_paypilot_db',
        error: 'DATABASE_URL not configured in Secrets. Operating with in-memory store.',
      };
      return;
    }

    const { config, host, dbName } = parsePostgresConnectionString(connStr);
    this.status.isConfigured = true;

    try {
      // If a pool already exists and is healthy, test it first
      if (this.pool) {
        try {
          const testClient = await this.pool.connect();
          testClient.release();
          this.status = {
            isConfigured: true,
            isConnected: true,
            provider: 'supabase',
            databaseName: dbName || 'postgres',
            host: host || 'Supabase PostgreSQL',
            error: undefined,
          };
          return;
        } catch (e) {
          // Pool is unhealthy, close it safely
          await this.pool.end().catch(() => {});
          this.pool = null;
        }
      }

      const newPool = new Pool(config);
      const client = await newPool.connect();
      try {
        await client.query('SELECT 1');
        // Auto-run schema initialization
        await this.runSchemaInit(client);
        this.pool = newPool;
        this.status = {
          isConfigured: true,
          isConnected: true,
          provider: 'supabase',
          databaseName: dbName || 'postgres',
          host: host || 'Supabase PostgreSQL',
          error: undefined,
        };
        console.info('[PayPilot DB] Connected successfully to PostgreSQL (' + (host || 'Supabase') + ')');
      } finally {
        client.release();
      }
    } catch (err: any) {
      if (this.pool) {
        await this.pool.end().catch(() => {});
        this.pool = null;
      }

      const isAuthError = err.message?.includes('authentication failed');
      const errorMsg = isAuthError
        ? 'PostgreSQL password authentication failed for user "postgres". Verify or reset your database password in Supabase: Project Settings > Database.'
        : `PostgreSQL connection pending: ${err.message}.`;

      console.log('[PayPilot DB] ' + errorMsg);

      this.status = {
        isConfigured: true,
        isConnected: false,
        provider: 'in-memory-fallback',
        databaseName: dbName || 'in_memory_paypilot_db',
        host: host,
        error: errorMsg,
      };
    }
  }

  private async runSchemaInit(client: pg.PoolClient) {
    const ddl = `
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS customers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 16 INCREMENT BY 1;

      CREATE TABLE IF NOT EXISTS invoices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          invoice_number TEXT NOT NULL UNIQUE,
          customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
          description TEXT DEFAULT 'Professional Services',
          currency VARCHAR(3) NOT NULL DEFAULT 'USD',
          subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
          total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
          issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
          due_date DATE NOT NULL,
          notes TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'draft',
          paypal_invoice_id TEXT UNIQUE,
          paypal_order_id TEXT UNIQUE,
          payment_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
          unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
          line_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
          paypal_order_id TEXT,
          paypal_capture_id TEXT UNIQUE,
          amount NUMERIC(12, 2) NOT NULL,
          currency VARCHAR(3) NOT NULL DEFAULT 'USD',
          status VARCHAR(20) NOT NULL,
          verified_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
          event_type TEXT NOT NULL,
          description TEXT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await client.query(ddl);
  }

  public getStatus(): DbStatus {
    return { ...this.status };
  }

  // --- Customers ---
  public async getCustomers(): Promise<
    (Customer & { invoice_count: number; total_invoiced: number; paid_amount: number; outstanding: number })[]
  > {
    await this.ensureInitialized();
    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      const q = `
        SELECT c.*,
          COALESCE(COUNT(DISTINCT i.id), 0)::int as invoice_count,
          COALESCE(SUM(CASE WHEN i.status != 'draft' AND i.status != 'cancelled' AND i.status != 'failed' THEN i.total_amount ELSE 0 END), 0)::float as total_invoiced,
          COALESCE(SUM(CASE WHEN p.status = 'COMPLETED' THEN p.amount ELSE 0 END), 0)::float as paid_amount
        FROM customers c
        LEFT JOIN invoices i ON i.customer_id = c.id
        LEFT JOIN payments p ON p.invoice_id = i.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `;
      const res = await this.pool.query(q);
      return res.rows.map((row) => ({
        ...row,
        total_invoiced: Math.round(row.total_invoiced * 100) / 100,
        paid_amount: Math.round(row.paid_amount * 100) / 100,
        outstanding: Math.max(0, Math.round((row.total_invoiced - row.paid_amount) * 100) / 100),
      }));
    }

    // In-memory implementation
    const result = [];
    for (const cust of this.memory.customers.values()) {
      let invoice_count = 0;
      let total_invoiced = 0;
      let paid_amount = 0;

      for (const inv of this.memory.invoices.values()) {
        if (inv.customer_id === cust.id) {
          invoice_count++;
          if (inv.status !== 'draft' && inv.status !== 'cancelled' && inv.status !== 'failed') {
            total_invoiced += inv.total_amount;
          }
          for (const p of this.memory.payments.values()) {
            if (p.invoice_id === inv.id && p.status === 'COMPLETED') {
              paid_amount += p.amount;
            }
          }
        }
      }

      total_invoiced = Math.round(total_invoiced * 100) / 100;
      paid_amount = Math.round(paid_amount * 100) / 100;
      const outstanding = Math.max(0, Math.round((total_invoiced - paid_amount) * 100) / 100);

      result.push({
        ...cust,
        invoice_count,
        total_invoiced,
        paid_amount,
        outstanding,
      });
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async getCustomerById(id: string): Promise<Customer | null> {
    await this.ensureInitialized();
    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      const res = await this.pool.query('SELECT * FROM customers WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return this.memory.customers.get(id) || null;
  }

  public async getOrCreateCustomer(name: string, email: string): Promise<Customer> {
    await this.ensureInitialized();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      const findRes = await this.pool.query('SELECT * FROM customers WHERE LOWER(email) = $1', [cleanEmail]);
      if (findRes.rows.length > 0) {
        return findRes.rows[0];
      }
      const insertRes = await this.pool.query(
        'INSERT INTO customers (name, email) VALUES ($1, $2) RETURNING *',
        [cleanName, cleanEmail]
      );
      return insertRes.rows[0];
    }

    // In-memory
    for (const c of this.memory.customers.values()) {
      if (c.email.toLowerCase() === cleanEmail) {
        return c;
      }
    }
    const newCust: Customer = {
      id: crypto.randomUUID(),
      name: cleanName,
      email: cleanEmail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.memory.customers.set(newCust.id, newCust);
    return newCust;
  }

  public async createCustomer(
    name: string,
    email: string
  ): Promise<Customer & { alreadyExists?: boolean }> {
    await this.ensureInitialized();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName) {
      throw new Error('Customer name is required.');
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Valid customer email is required.');
    }

    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      const findRes = await this.pool.query('SELECT * FROM customers WHERE LOWER(email) = $1', [cleanEmail]);
      if (findRes.rows.length > 0) {
        return { ...findRes.rows[0], alreadyExists: true };
      }
      const insertRes = await this.pool.query(
        'INSERT INTO customers (name, email) VALUES ($1, $2) RETURNING *',
        [cleanName, cleanEmail]
      );
      return insertRes.rows[0];
    }

    // In-memory
    for (const c of this.memory.customers.values()) {
      if (c.email.toLowerCase() === cleanEmail) {
        return { ...c, alreadyExists: true };
      }
    }
    const newCust: Customer = {
      id: crypto.randomUUID(),
      name: cleanName,
      email: cleanEmail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.memory.customers.set(newCust.id, newCust);
    return newCust;
  }

  // --- Invoices ---
  public async getInvoices(filter?: { status?: string; search?: string }): Promise<Invoice[]> {
    await this.ensureInitialized();
    const today = new Date().toISOString().split('T')[0];

    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      let query = `
        SELECT i.*, c.name as customer_name, c.email as customer_email
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (filter?.status && filter.status !== 'all') {
        const norm = filter.status.toLowerCase();
        if (norm === 'overdue') {
          query += ` AND i.status NOT IN ('paid', 'draft', 'cancelled', 'failed')
                     AND (i.payment_url IS NOT NULL OR i.paypal_order_id IS NOT NULL OR i.status = 'sent')
                     AND i.due_date < CURRENT_DATE`;
        } else if (norm === 'created') {
          query += ` AND i.status = 'created' AND (i.payment_url IS NULL AND i.paypal_order_id IS NULL)`;
        } else if (norm === 'sent') {
          query += ` AND (i.status = 'sent' OR i.payment_url IS NOT NULL) AND i.status != 'paid' AND i.due_date >= CURRENT_DATE`;
        } else if (norm === 'paid') {
          query += ` AND i.status = 'paid'`;
        } else if (norm === 'draft') {
          query += ` AND i.status = 'draft'`;
        } else {
          params.push(filter.status);
          query += ` AND i.status = $${params.length}`;
        }
      }
      if (filter?.search) {
        params.push(`%${filter.search}%`);
        query += ` AND (i.invoice_number ILIKE $${params.length} OR c.name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR i.description ILIKE $${params.length})`;
      }
      query += ` ORDER BY i.created_at DESC`;
      const res = await this.pool.query(query, params);

      const formatDate = (val: any) => {
        if (!val) return '';
        if (val instanceof Date) return val.toISOString().split('T')[0];
        return String(val).split('T')[0];
      };

      const invoices: Invoice[] = res.rows.map((r) => ({
        ...r,
        issue_date: formatDate(r.issue_date),
        due_date: formatDate(r.due_date),
        subtotal: parseFloat(r.subtotal) || 0,
        total_amount: parseFloat(r.total_amount) || 0,
      }));
      return invoices;
    }

    // In-memory
    let list: Invoice[] = [];
    for (const inv of this.memory.invoices.values()) {
      const cust = this.memory.customers.get(inv.customer_id);
      const row: Invoice = {
        ...inv,
        customer_name: cust?.name,
        customer_email: cust?.email,
      };

      if (filter?.status && filter.status !== 'all') {
        const norm = filter.status.toLowerCase();
        if (norm === 'overdue') {
          if (!isInvoiceOverdue(row, today)) continue;
        } else if (norm === 'created') {
          if (row.status !== 'created' || isInvoiceOverdue(row, today)) continue;
        } else if (norm === 'sent') {
          if ((row.status !== 'sent' && !row.payment_url) || isInvoiceOverdue(row, today) || row.status === 'paid') continue;
        } else if (norm === 'paid') {
          if (row.status !== 'paid') continue;
        } else if (norm === 'draft') {
          if (row.status !== 'draft') continue;
        } else if (row.status !== filter.status) {
          continue;
        }
      }
      if (filter?.search) {
        const s = filter.search.toLowerCase();
        const matches =
          row.invoice_number.toLowerCase().includes(s) ||
          (cust?.name && cust.name.toLowerCase().includes(s)) ||
          (cust?.email && cust.email.toLowerCase().includes(s)) ||
          (row.description && row.description.toLowerCase().includes(s));
        if (!matches) continue;
      }
      list.push(row);
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async getInvoiceById(id: string): Promise<Invoice | null> {
    await this.ensureInitialized();
    const cleanId = id?.trim();
    if (!cleanId) return null;

    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      try {
        const invRes = await this.pool.query(
          `SELECT i.*, c.name as customer_name, c.email as customer_email
           FROM invoices i
           LEFT JOIN customers c ON c.id = i.customer_id
           WHERE (i.id::text = $1 OR i.invoice_number = $1)`,
          [cleanId]
        );
        if (invRes.rows.length === 0) return null;
        const inv = invRes.rows[0];
        const invoiceUuid = inv.id;

        const itemsRes = await this.pool.query(
          'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at ASC',
          [invoiceUuid]
        );
        const paymentsRes = await this.pool.query(
          'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC',
          [invoiceUuid]
        );

        const formatDate = (val: any) => {
          if (!val) return '';
          if (val instanceof Date) return val.toISOString().split('T')[0];
          return String(val).split('T')[0];
        };

        return {
          ...inv,
          issue_date: formatDate(inv.issue_date),
          due_date: formatDate(inv.due_date),
          subtotal: parseFloat(inv.subtotal) || 0,
          total_amount: parseFloat(inv.total_amount) || 0,
          items: itemsRes.rows.map((it) => ({
            ...it,
            quantity: parseFloat(it.quantity) || 0,
            unit_price: parseFloat(it.unit_price) || 0,
            line_total: parseFloat(it.line_total) || 0,
          })),
          payments: paymentsRes.rows.map((p) => ({
            ...p,
            amount: parseFloat(p.amount) || 0,
          })),
        };
      } catch (err: any) {
        console.error(`[PayPilot DB] Error retrieving invoice "${cleanId}":`, err.message);
        throw err;
      }
    }

    // In-memory fallback
    let inv = this.memory.invoices.get(cleanId);
    if (!inv) {
      for (const item of this.memory.invoices.values()) {
        if (item.invoice_number === cleanId) {
          inv = item;
          break;
        }
      }
    }
    if (!inv) return null;

    const cust = this.memory.customers.get(inv.customer_id);
    const items = this.memory.invoiceItems.get(inv.id) || [];
    const payments = Array.from(this.memory.payments.values()).filter((p) => p.invoice_id === inv!.id);

    return {
      ...inv,
      customer_name: cust?.name,
      customer_email: cust?.email,
      items,
      payments,
    };
  }

  public async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    await this.ensureInitialized();
    return this.getInvoiceById(invoiceNumber);
  }

  private nextInvoiceSeq = 15;

  public async generateNextInvoiceNumber(): Promise<string> {
    await this.ensureInitialized();
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      try {
        const seqRes = await this.pool.query("SELECT nextval('invoice_number_seq') AS num");
        const num = parseInt(seqRes.rows[0].num, 10);
        return `${prefix}${num.toString().padStart(3, '0')}`;
      } catch (err: any) {
        // Fallback: create sequence if not yet initialized, then fetch nextval
        await this.pool.query('CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 16 INCREMENT BY 1');
        const seqRes = await this.pool.query("SELECT nextval('invoice_number_seq') AS num");
        const num = parseInt(seqRes.rows[0].num, 10);
        return `${prefix}${num.toString().padStart(3, '0')}`;
      }
    }

    // In-memory atomic monotonic counter (starts at 16 after 15 baseline invoices)
    this.nextInvoiceSeq = Math.max(this.nextInvoiceSeq + 1, 16);
    return `${prefix}${this.nextInvoiceSeq.toString().padStart(3, '0')}`;
  }

  public async createInvoice(data: {
    customer_name: string;
    customer_email: string;
    description: string;
    currency: string;
    issue_date: string;
    due_date: string;
    notes?: string;
    items: { description: string; quantity: number; unit_price: number }[];
    is_draft?: boolean;
  }): Promise<Invoice> {
    if (data.due_date < data.issue_date) {
      throw new Error('Due date cannot be earlier than issue date.');
    }

    // 1. Calculate totals with exact decimal precision
    let subtotal = 0;
    const computedItems = data.items.map((item) => {
      const qty = Math.round(item.quantity * 100) / 100;
      const unit = Math.round(item.unit_price * 100) / 100;
      const total = Math.round(qty * unit * 100) / 100;
      subtotal += total;
      return {
        description: item.description.trim(),
        quantity: qty,
        unit_price: unit,
        line_total: total,
      };
    });
    subtotal = Math.round(subtotal * 100) / 100;
    const totalAmount = subtotal;

    // 2. Ensure customer exists
    const customer = await this.getOrCreateCustomer(data.customer_name, data.customer_email);
    const invoiceId = crypto.randomUUID();
    const status: InvoiceStatus = data.is_draft ? 'draft' : 'created';
    const now = new Date().toISOString();

    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      for (let attempt = 0; attempt < 5; attempt++) {
        const invoiceNumber = await this.generateNextInvoiceNumber();
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');
          const invQ = `
            INSERT INTO invoices (
              id, invoice_number, customer_id, description, currency,
              subtotal, total_amount, issue_date, due_date, notes, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
          `;
          await client.query(invQ, [
            invoiceId,
            invoiceNumber,
            customer.id,
            data.description,
            data.currency.toUpperCase(),
            subtotal,
            totalAmount,
            data.issue_date,
            data.due_date,
            data.notes || '',
            status,
            now,
            now,
          ]);

          for (const item of computedItems) {
            await client.query(
              `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, line_total, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [crypto.randomUUID(), invoiceId, item.description, item.quantity, item.unit_price, item.line_total, now]
            );
          }

          // Activity log
          await client.query(
            `INSERT INTO activity_logs (id, invoice_id, event_type, description, metadata, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              crypto.randomUUID(),
              invoiceId,
              data.is_draft ? 'DRAFT_CREATED' : 'INVOICE_CREATED',
              `Created ${data.is_draft ? 'draft ' : ''}invoice ${invoiceNumber} for ${customer.name} ($${totalAmount.toFixed(2)} ${data.currency})`,
              JSON.stringify({ invoice_number: invoiceNumber, amount: totalAmount, currency: data.currency }),
              now,
            ]
          );

          await client.query('COMMIT');
          client.release();
          return (await this.getInvoiceById(invoiceId))!;
        } catch (err: any) {
          await client.query('ROLLBACK');
          client.release();
          if (err.code === '23505' && err.message?.includes('invoice_number') && attempt < 4) {
            this.nextInvoiceSeq += 1;
            continue;
          }
          throw err;
        }
      }
    }

    // In-memory
    const memInvoiceNumber = await this.generateNextInvoiceNumber();
    const newInvoice: Invoice = {
      id: invoiceId,
      invoice_number: memInvoiceNumber,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_email: customer.email,
      description: data.description,
      currency: data.currency.toUpperCase(),
      subtotal,
      total_amount: totalAmount,
      issue_date: data.issue_date,
      due_date: data.due_date,
      notes: data.notes || '',
      status,
      paypal_invoice_id: null,
      paypal_order_id: null,
      payment_url: null,
      created_at: now,
      updated_at: now,
    };
    this.memory.invoices.set(invoiceId, newInvoice);

    const items: InvoiceItem[] = computedItems.map((it) => ({
      id: crypto.randomUUID(),
      invoice_id: invoiceId,
      ...it,
      created_at: now,
    }));
    this.memory.invoiceItems.set(invoiceId, items);

    this.memory.activityLogs.unshift({
      id: crypto.randomUUID(),
      invoice_id: invoiceId,
      event_type: data.is_draft ? 'DRAFT_CREATED' : 'INVOICE_CREATED',
      description: `Created ${data.is_draft ? 'draft ' : ''}invoice ${memInvoiceNumber} for ${customer.name} ($${totalAmount.toFixed(2)} ${data.currency})`,
      metadata: { invoice_number: memInvoiceNumber, amount: totalAmount, currency: data.currency },
      created_at: now,
    });

    return {
      ...newInvoice,
      items,
      payments: [],
    };
  }

  public async updateInvoice(
    id: string,
    data: {
      customer_name?: string;
      customer_email?: string;
      description?: string;
      currency?: string;
      issue_date?: string;
      due_date?: string;
      notes?: string;
      items?: { description: string; quantity: number; unit_price: number }[];
      status?: 'draft' | 'created' | 'sent';
    }
  ): Promise<Invoice> {
    await this.ensureInitialized();
    const existing = await this.getInvoiceById(id);
    if (!existing) throw new Error('Invoice not found');

    if (existing.status === 'paid' || existing.payments?.some((p) => p.status === 'COMPLETED')) {
      throw new Error(`Cannot edit invoice in '${existing.status}' status. Paid invoices cannot be edited as they have verified payment history.`);
    }
    if (existing.status === 'cancelled') {
      throw new Error("Cannot edit invoice in 'cancelled' status.");
    }
    if (existing.status === 'failed') {
      throw new Error("Cannot edit invoice in 'failed' status.");
    }

    const effectiveIssueDate = data.issue_date || existing.issue_date;
    const effectiveDueDate = data.due_date || existing.due_date;
    if (effectiveDueDate < effectiveIssueDate) {
      throw new Error('Due date cannot be earlier than issue date.');
    }

    let customerId = existing.customer_id;
    if (data.customer_name && data.customer_email) {
      const cust = await this.getOrCreateCustomer(data.customer_name, data.customer_email);
      customerId = cust.id;
    }

    let subtotal = existing.subtotal;
    let computedItems: { description: string; quantity: number; unit_price: number; line_total: number }[] | null = null;

    if (data.items) {
      subtotal = 0;
      computedItems = data.items.map((item) => {
        const qty = Math.round(item.quantity * 100) / 100;
        const unit = Math.round(item.unit_price * 100) / 100;
        const total = Math.round(qty * unit * 100) / 100;
        subtotal += total;
        return {
          description: item.description.trim(),
          quantity: qty,
          unit_price: unit,
          line_total: total,
        };
      });
      subtotal = Math.round(subtotal * 100) / 100;
    }
    const totalAmount = subtotal;

    // Safety: Invalidate payment link if invoice total or items change on an invoice with an active link
    let paypalOrderId = existing.paypal_order_id;
    let paymentUrl = existing.payment_url;
    let nextStatus = data.status || existing.status;
    let linkInvalidated = false;

    if (existing.paypal_order_id || existing.payment_url) {
      const amountChanged = Math.abs(totalAmount - existing.total_amount) > 0.001;
      const currencyChanged = data.currency && data.currency.toUpperCase() !== existing.currency.toUpperCase();
      const itemsChanged = Boolean(computedItems);
      if (amountChanged || currencyChanged || itemsChanged) {
        paypalOrderId = null;
        paymentUrl = null;
        linkInvalidated = true;
        if (nextStatus === 'sent') {
          nextStatus = 'created';
        }
      }
    }

    const now = new Date().toISOString();

    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE invoices
           SET customer_id = $1, description = COALESCE($2, description), currency = COALESCE($3, currency),
               subtotal = $4, total_amount = $5, issue_date = COALESCE($6, issue_date),
               due_date = COALESCE($7, due_date), notes = COALESCE($8, notes), status = $9,
               paypal_order_id = $10, payment_url = $11, updated_at = $12
           WHERE id = $13`,
          [
            customerId,
            data.description,
            data.currency?.toUpperCase(),
            subtotal,
            totalAmount,
            data.issue_date,
            data.due_date,
            data.notes,
            nextStatus,
            paypalOrderId,
            paymentUrl,
            now,
            existing.id,
          ]
        );

        if (computedItems) {
          await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [existing.id]);
          for (const item of computedItems) {
            await client.query(
              `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, line_total, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [crypto.randomUUID(), existing.id, item.description, item.quantity, item.unit_price, item.line_total, now]
            );
          }
        }

        const isNowIssued = nextStatus === 'created' && existing.status === 'draft';
        await client.query(
          `INSERT INTO activity_logs (id, invoice_id, event_type, description, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            crypto.randomUUID(),
            existing.id,
            linkInvalidated ? 'PAYMENT_LINK_INVALIDATED' : isNowIssued ? 'INVOICE_SENT' : 'INVOICE_UPDATED',
            linkInvalidated
              ? `Updated invoice ${existing.invoice_number}; prior PayPal payment link invalidated to prevent stale checkout.`
              : isNowIssued
              ? `Issued invoice ${existing.invoice_number} to ${data.customer_name || existing.customer_name}`
              : `Updated invoice ${existing.invoice_number}`,
            JSON.stringify({ updated_fields: Object.keys(data), status: nextStatus, link_invalidated: linkInvalidated }),
            now,
          ]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      return (await this.getInvoiceById(existing.id))!;
    }

    // In-memory
    const updated: Invoice = {
      ...existing,
      customer_id: customerId,
      customer_name: data.customer_name || existing.customer_name,
      customer_email: data.customer_email || existing.customer_email,
      description: data.description ?? existing.description,
      currency: (data.currency ?? existing.currency).toUpperCase(),
      subtotal,
      total_amount: totalAmount,
      issue_date: data.issue_date ?? existing.issue_date,
      due_date: data.due_date ?? existing.due_date,
      notes: data.notes ?? existing.notes,
      status: nextStatus,
      paypal_order_id: paypalOrderId,
      payment_url: paymentUrl,
      updated_at: now,
    };
    this.memory.invoices.set(existing.id, updated);

    if (computedItems) {
      const items: InvoiceItem[] = computedItems.map((it) => ({
        id: crypto.randomUUID(),
        invoice_id: existing.id,
        ...it,
        created_at: now,
      }));
      this.memory.invoiceItems.set(existing.id, items);
    }

    const isNowIssued = nextStatus === 'created' && existing.status === 'draft';
    this.memory.activityLogs.unshift({
      id: crypto.randomUUID(),
      invoice_id: existing.id,
      event_type: linkInvalidated ? 'PAYMENT_LINK_INVALIDATED' : isNowIssued ? 'INVOICE_SENT' : 'INVOICE_UPDATED',
      description: linkInvalidated
        ? `Updated invoice ${existing.invoice_number}; prior PayPal payment link invalidated to prevent stale checkout.`
        : isNowIssued
        ? `Issued invoice ${existing.invoice_number} to ${data.customer_name || existing.customer_name}`
        : `Updated invoice ${existing.invoice_number}`,
      metadata: { updated_fields: Object.keys(data), status: nextStatus, link_invalidated: linkInvalidated },
      created_at: now,
    });

    return (await this.getInvoiceById(existing.id))!;
  }

  public async updateDraftInvoice(
    id: string,
    data: {
      customer_name?: string;
      customer_email?: string;
      description?: string;
      currency?: string;
      issue_date?: string;
      due_date?: string;
      notes?: string;
      items?: { description: string; quantity: number; unit_price: number }[];
      status?: 'draft' | 'created';
    }
  ): Promise<Invoice> {
    const existing = await this.getInvoiceById(id);
    if (!existing) throw new Error('Invoice not found');
    if (existing.status !== 'draft') {
      throw new Error(`Cannot edit invoice in '${existing.status}' status. Only draft invoices can be edited.`);
    }
    return this.updateInvoice(id, data);
  }

  public async deleteInvoice(id: string): Promise<{ success: boolean; action: 'deleted' | 'voided'; invoice_number: string }> {
    await this.ensureInitialized();
    const existing = await this.getInvoiceById(id);
    if (!existing) {
      throw new Error('Invoice not found');
    }

    // Guard: Paid invoices cannot be deleted (preserves immutable accounting audit trail)
    if (existing.status === 'paid') {
      throw new Error('Paid invoices cannot be deleted as they form part of immutable financial records.');
    }
    const hasCompletedPayments = existing.payments && existing.payments.some((p) => p.status === 'COMPLETED');
    if (hasCompletedPayments) {
      throw new Error('Invoices with verified payments cannot be deleted.');
    }

    const now = new Date().toISOString();

    // Draft invoices: Safe physical deletion
    if (existing.status === 'draft') {
      if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [existing.id]);
          await client.query('UPDATE activity_logs SET invoice_id = NULL WHERE invoice_id = $1', [existing.id]);
          await client.query('DELETE FROM invoices WHERE id = $1', [existing.id]);
          await client.query(
            `INSERT INTO activity_logs (id, invoice_id, event_type, description, metadata, created_at)
             VALUES ($1, NULL, 'INVOICE_DELETED', $2, $3, $4)`,
            [
              crypto.randomUUID(),
              `Permanently deleted draft invoice ${existing.invoice_number}`,
              JSON.stringify({ invoice_number: existing.invoice_number, total_amount: existing.total_amount }),
              now,
            ]
          );
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } else {
        this.memory.invoices.delete(existing.id);
        this.memory.invoiceItems.delete(existing.id);
        this.memory.activityLogs.unshift({
          id: crypto.randomUUID(),
          invoice_id: null,
          event_type: 'INVOICE_DELETED',
          description: `Permanently deleted draft invoice ${existing.invoice_number}`,
          metadata: { invoice_number: existing.invoice_number, total_amount: existing.total_amount },
          created_at: now,
        });
      }

      return { success: true, action: 'deleted', invoice_number: existing.invoice_number };
    }

    // Issued invoices (created, sent, pending, overdue):
    // Void / archive the invoice by transitioning status to 'cancelled'
    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      await this.pool.query(
        `UPDATE invoices SET status = 'cancelled', updated_at = $1 WHERE id = $2`,
        [now, existing.id]
      );
      await this.pool.query(
        `INSERT INTO activity_logs (id, invoice_id, event_type, description, metadata, created_at)
         VALUES ($1, $2, 'INVOICE_VOIDED', $3, $4, $5)`,
        [
          crypto.randomUUID(),
          existing.id,
          `Voided/cancelled unpaid invoice ${existing.invoice_number}`,
          JSON.stringify({ invoice_number: existing.invoice_number, previous_status: existing.status }),
          now,
        ]
      );
    } else {
      const inv = this.memory.invoices.get(existing.id);
      if (inv) {
        inv.status = 'cancelled';
        inv.updated_at = now;
      }
      this.memory.activityLogs.unshift({
        id: crypto.randomUUID(),
        invoice_id: existing.id,
        event_type: 'INVOICE_VOIDED',
        description: `Voided/cancelled unpaid invoice ${existing.invoice_number}`,
        metadata: { invoice_number: existing.invoice_number, previous_status: existing.status },
        created_at: now,
      });
    }

    return { success: true, action: 'voided', invoice_number: existing.invoice_number };
  }

  public async voidInvoice(id: string): Promise<Invoice> {
    await this.deleteInvoice(id);
    return (await this.getInvoiceById(id))!;
  }

  /**
   * Safely delete a temporary test fixture created during automated tests.
   * Ensures automated test fixtures do not leak into the normal application database.
   */
  public async deleteTestFixture(id: string): Promise<void> {
    await this.ensureInitialized();
    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM payments WHERE invoice_id = $1', [id]);
        await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);
        await client.query('DELETE FROM activity_logs WHERE invoice_id = $1', [id]);
        await client.query('DELETE FROM invoices WHERE id = $1', [id]);
        await client.query('COMMIT');
      } catch (_err) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    } else {
      this.memory.invoices.delete(id);
      this.memory.invoiceItems.delete(id);
      for (const [k, p] of this.memory.payments.entries()) {
        if (p.invoice_id === id) this.memory.payments.delete(k);
      }
    }
  }

  public async updateInvoicePayPalInfo(
    id: string,
    info: {
      paypal_order_id?: string | null;
      paypal_invoice_id?: string | null;
      payment_url?: string | null;
      status?: InvoiceStatus;
    }
  ): Promise<Invoice> {
    const existing = await this.getInvoiceById(id);
    if (!existing) throw new Error('Invoice not found');
    const now = new Date().toISOString();

    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      await this.pool.query(
        `UPDATE invoices
         SET paypal_order_id = COALESCE($1, paypal_order_id),
             paypal_invoice_id = COALESCE($2, paypal_invoice_id),
             payment_url = COALESCE($3, payment_url),
             status = COALESCE($4, status),
             updated_at = $5
         WHERE id = $6`,
        [info.paypal_order_id, info.paypal_invoice_id, info.payment_url, info.status, now, id]
      );
      return (await this.getInvoiceById(id))!;
    }

    const updated: Invoice = {
      ...existing,
      paypal_order_id: info.paypal_order_id !== undefined ? info.paypal_order_id : existing.paypal_order_id,
      paypal_invoice_id: info.paypal_invoice_id !== undefined ? info.paypal_invoice_id : existing.paypal_invoice_id,
      payment_url: info.payment_url !== undefined ? info.payment_url : existing.payment_url,
      status: info.status || existing.status,
      updated_at: now,
    };
    this.memory.invoices.set(id, updated);
    return updated;
  }

  // --- Payments & Verification ---
  public async recordVerifiedPayment(data: {
    invoice_id: string;
    paypal_order_id?: string;
    paypal_capture_id: string;
    amount: number;
    currency: string;
    status: string;
  }): Promise<Payment> {
    const inv = await this.getInvoiceById(data.invoice_id);
    if (!inv) throw new Error('Invoice not found for payment');

    // 1. Validate payment status: must be COMPLETED
    if (data.status !== 'COMPLETED') {
      throw new Error(`Cannot record payment with incomplete status: '${data.status}'. Only COMPLETED captures can be recorded.`);
    }

    // 2. Validate currency and amount
    if (data.currency.toUpperCase() !== inv.currency.toUpperCase()) {
      throw new Error(`Payment currency (${data.currency}) does not match invoice currency (${inv.currency}).`);
    }
    if (Math.abs(data.amount - inv.total_amount) > 0.01) {
      throw new Error(`Payment amount ($${data.amount.toFixed(2)}) does not match invoice total ($${inv.total_amount.toFixed(2)}).`);
    }

    // 3. Idempotency: verify if this paypal_capture_id is already recorded
    const existingPayment = await this.getPaymentByCaptureId(data.paypal_capture_id);
    if (existingPayment) {
      return existingPayment;
    }

    // If invoice is already marked as paid, check if a payment record exists
    if (inv.status === 'paid') {
      const existingByInv = await this.getPaymentByInvoiceId(inv.id);
      if (existingByInv) {
        return existingByInv;
      }
    }

    const paymentId = crypto.randomUUID();
    const now = new Date().toISOString();

    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const payRes = await client.query(
          `INSERT INTO payments (id, invoice_id, paypal_order_id, paypal_capture_id, amount, currency, status, verified_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (paypal_capture_id) DO UPDATE SET updated_at = EXCLUDED.updated_at
           RETURNING *`,
          [
            paymentId,
            data.invoice_id,
            data.paypal_order_id || null,
            data.paypal_capture_id,
            data.amount,
            data.currency.toUpperCase(),
            data.status,
            now,
            now,
            now,
          ]
        );

        // Update invoice status to 'paid'
        await client.query(
          `UPDATE invoices SET status = 'paid', updated_at = $1 WHERE id = $2`,
          [now, data.invoice_id]
        );

        // Activity log only if this was a new insertion
        await client.query(
          `INSERT INTO activity_logs (id, invoice_id, event_type, description, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            crypto.randomUUID(),
            data.invoice_id,
            'PAYMENT_VERIFIED',
            `Verified PayPal Sandbox payment of $${data.amount.toFixed(2)} ${data.currency} for ${inv.invoice_number} (Capture: ${data.paypal_capture_id})`,
            JSON.stringify({
              order_id: data.paypal_order_id,
              capture_id: data.paypal_capture_id,
              amount: data.amount,
              currency: data.currency,
              status: data.status,
            }),
            now,
          ]
        );

        await client.query('COMMIT');
        const p = payRes.rows[0];
        return {
          ...p,
          amount: parseFloat(p.amount),
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory
    const newPayment: Payment = {
      id: paymentId,
      invoice_id: data.invoice_id,
      paypal_order_id: data.paypal_order_id || null,
      paypal_capture_id: data.paypal_capture_id,
      amount: data.amount,
      currency: data.currency.toUpperCase(),
      status: data.status,
      verified_at: now,
      created_at: now,
      updated_at: now,
    };
    this.memory.payments.set(paymentId, newPayment);

    // Update invoice status to 'paid'
    const updatedInvoice: Invoice = {
      ...inv,
      status: 'paid',
      updated_at: now,
    };
    this.memory.invoices.set(data.invoice_id, updatedInvoice);

    this.memory.activityLogs.unshift({
      id: crypto.randomUUID(),
      invoice_id: data.invoice_id,
      event_type: 'PAYMENT_VERIFIED',
      description: `Verified PayPal Sandbox payment of $${data.amount.toFixed(2)} ${data.currency} for ${inv.invoice_number} (Capture: ${data.paypal_capture_id})`,
      metadata: {
        order_id: data.paypal_order_id,
        capture_id: data.paypal_capture_id,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
      },
      created_at: now,
    });

    return newPayment;
  }

  public async getPaymentByCaptureId(captureId: string): Promise<Payment | null> {
    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      const res = await this.pool.query('SELECT * FROM payments WHERE paypal_capture_id = $1', [captureId]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return { ...r, amount: parseFloat(r.amount) };
    }
    for (const p of this.memory.payments.values()) {
      if (p.paypal_capture_id === captureId) return p;
    }
    return null;
  }

  public async getPaymentByInvoiceId(invoiceId: string): Promise<Payment | null> {
    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      const res = await this.pool.query(
        'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1',
        [invoiceId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return { ...r, amount: parseFloat(r.amount) };
    }
    for (const p of this.memory.payments.values()) {
      if (p.invoice_id === invoiceId) return p;
    }
    return null;
  }

  // --- Activity Logs ---
  public async logActivity(data: {
    invoice_id?: string | null;
    event_type: string;
    description: string;
    metadata?: Record<string, any>;
  }): Promise<ActivityLog> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const meta = data.metadata || {};

    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      const res = await this.pool.query(
        `INSERT INTO activity_logs (id, invoice_id, event_type, description, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, data.invoice_id || null, data.event_type, data.description, JSON.stringify(meta), now]
      );
      return res.rows[0];
    }

    const log: ActivityLog = {
      id,
      invoice_id: data.invoice_id || null,
      event_type: data.event_type,
      description: data.description,
      metadata: meta,
      created_at: now,
    };
    this.memory.activityLogs.unshift(log);
    return log;
  }

  public async getActivityLogs(limit = 50): Promise<ActivityLog[]> {
    if (this.pool && this.status.isConnected && this.status.provider === 'supabase') {
      const res = await this.pool.query(
        `SELECT a.*, i.invoice_number
         FROM activity_logs a
         LEFT JOIN invoices i ON i.id = a.invoice_id
         ORDER BY a.created_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.rows;
    }
    return this.memory.activityLogs.slice(0, limit);
  }

  // --- Metrics ---
  public async getDashboardMetrics(): Promise<DashboardMetrics> {
    const invoices = await this.getInvoices();
    const today = new Date().toISOString().split('T')[0];

    let totalInvoiced = 0;
    let amountReceived = 0;
    let overdueCount = 0;
    let paidInvoicesCount = 0;

    for (const inv of invoices) {
      // Drafts, cancelled, and failed are NOT included in total invoiced
      if (inv.status !== 'draft' && inv.status !== 'cancelled' && inv.status !== 'failed') {
        totalInvoiced += inv.total_amount;
      }
      if (inv.status === 'paid') {
        paidInvoicesCount++;
        amountReceived += inv.total_amount;
      } else if (isInvoiceOverdue(inv, today)) {
        overdueCount++;
      }
    }

    totalInvoiced = Math.round(totalInvoiced * 100) / 100;
    amountReceived = Math.round(amountReceived * 100) / 100;
    const outstandingBalance = Math.max(0, Math.round((totalInvoiced - amountReceived) * 100) / 100);

    return {
      totalInvoiced,
      amountReceived,
      outstandingBalance,
      overdueCount,
      totalInvoicesCount: invoices.length,
      paidInvoicesCount,
      currency: 'USD',
    };
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end().catch(() => {});
      this.pool = null;
      this.status.isConnected = false;
    }
  }
}

export const db = new DatabaseService();
