export type InvoiceStatus =
  | 'draft'
  | 'created'
  | 'sent'
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'failed';

export interface Customer {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
  invoice_count?: number;
  total_invoiced?: number;
  paid_amount?: number;
  outstanding?: number;
}

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface CreateCustomerPayload {
  name: string;
  email: string;
}

export interface UpdateInvoicePayload {
  customer_name?: string;
  customer_email?: string;
  description?: string;
  currency?: string;
  issue_date?: string;
  due_date?: string;
  notes?: string;
  items?: {
    description: string;
    quantity: number;
    unit_price: number;
  }[];
  status?: InvoiceStatus;
}

export interface Payment {
  id: string;
  invoice_id: string;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  amount: number;
  currency: string;
  status: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  description: string;
  currency: string;
  subtotal: number;
  total_amount: number;
  issue_date: string;
  due_date: string;
  notes: string | null;
  status: InvoiceStatus;
  paypal_invoice_id: string | null;
  paypal_order_id: string | null;
  payment_url: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
  payments?: Payment[];
}

export interface ActivityLog {
  id: string;
  invoice_id: string | null;
  invoice_number?: string;
  event_type: string;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface DashboardMetrics {
  totalInvoiced: number;
  amountReceived: number;
  outstandingBalance: number;
  overdueCount: number;
  totalInvoicesCount: number;
  paidInvoicesCount: number;
  currency: string;
}

export interface IntegrationStatus {
  database: {
    configured: boolean;
    connected: boolean;
    provider: string;
    databaseName?: string;
    host?: string;
    error?: string;
  };
  paypal: {
    configured: boolean;
    reachable: boolean;
    baseUrl: string;
    clientIdMasked: string | null;
    mode: string;
    error?: string;
  };
  gemini: {
    configured: boolean;
    model: string;
    error?: string;
  };
}

export interface ExtractedInvoiceDraft {
  customer_name: string;
  customer_email: string | null;
  description: string;
  currency: string;
  issue_date: string;
  due_date: string;
  notes: string;
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
  clarifications_needed: string[];
}

/**
 * Business Rule: Overdue Eligibility
 * - Paid, draft, cancelled, or failed invoices are never overdue.
 * - An invoice without a payment link must remain Created even if its due date has passed.
 * - An invoice with a successfully generated payment link, an outstanding balance, and a due date earlier than today is overdue.
 * - Due date equal to today is NOT overdue.
 */
export function isInvoiceOverdue(
  invoice: {
    status: string;
    due_date: string;
    payment_url?: string | null;
    paypal_order_id?: string | null;
  },
  referenceDate?: string
): boolean {
  const normStatus = (invoice.status || '').toLowerCase();
  if (normStatus === 'paid' || normStatus === 'draft' || normStatus === 'cancelled' || normStatus === 'failed') {
    return false;
  }
  const hasPaymentLink = Boolean(
    invoice.payment_url || invoice.paypal_order_id || normStatus === 'sent'
  );
  if (!hasPaymentLink) {
    return false;
  }
  const today = referenceDate || new Date().toISOString().split('T')[0];
  const dueDate = String(invoice.due_date || '').split('T')[0];
  if (!dueDate) return false;
  return dueDate < today;
}

export function getEffectiveInvoiceStatus(
  invoice: Invoice,
  referenceDate?: string
): InvoiceStatus {
  if (
    invoice.status === 'paid' ||
    invoice.status === 'draft' ||
    invoice.status === 'cancelled' ||
    invoice.status === 'failed'
  ) {
    return invoice.status;
  }
  if (isInvoiceOverdue(invoice, referenceDate)) {
    return 'overdue';
  }
  return invoice.status;
}
