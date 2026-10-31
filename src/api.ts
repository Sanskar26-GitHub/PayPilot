import type {
  Invoice,
  InvoiceStatus,
  Customer,
  DashboardMetrics,
  IntegrationStatus,
  ActivityLog,
  ExtractedInvoiceDraft,
  Payment,
} from './types.ts';

const API_BASE = '/api';

export async function fetchHealth(): Promise<any> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchIntegrationStatus(recheck = false): Promise<IntegrationStatus> {
  const res = await fetch(`${API_BASE}/integrations/status${recheck ? '?recheck=true' : ''}`);
  if (!res.ok) throw new Error('Failed to load integration status');
  return res.json();
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await fetch(`${API_BASE}/dashboard/metrics`);
  if (!res.ok) throw new Error('Failed to load dashboard metrics');
  return res.json();
}

export async function fetchInvoices(filter?: { status?: string; search?: string }): Promise<Invoice[]> {
  const params = new URLSearchParams();
  if (filter?.status && filter.status !== 'all') params.set('status', filter.status);
  if (filter?.search) params.set('search', filter.search);

  const res = await fetch(`${API_BASE}/invoices?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load invoices');
  return res.json();
}

export async function fetchInvoiceById(id: string): Promise<Invoice> {
  const res = await fetch(`${API_BASE}/invoices/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch invoice');
  }
  return res.json();
}

export async function createInvoice(payload: {
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
  const res = await fetch(`${API_BASE}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data.issues && data.issues[0]?.message) || data.error || 'Failed to create invoice');
  }
  return data;
}

export async function updateInvoice(
  id: string,
  payload: {
    customer_name?: string;
    customer_email?: string;
    description?: string;
    currency?: string;
    issue_date?: string;
    due_date?: string;
    notes?: string;
    items?: { description: string; quantity: number; unit_price: number }[];
    status?: InvoiceStatus;
  }
): Promise<Invoice> {
  const res = await fetch(`${API_BASE}/invoices/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data.issues && data.issues[0]?.message) || data.error || 'Failed to update invoice');
  }
  return data;
}

export async function updateDraftInvoice(
  id: string,
  payload: {
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
  return updateInvoice(id, payload);
}

export async function deleteInvoice(id: string): Promise<{ success: boolean; action: 'deleted' | 'voided'; invoice_number: string }> {
  const res = await fetch(`${API_BASE}/invoices/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete invoice');
  }
  return data;
}

export async function voidInvoice(id: string): Promise<Invoice> {
  const res = await fetch(`${API_BASE}/invoices/${id}/void`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to void invoice');
  }
  return data;
}

export async function createPayPalOrder(invoiceId: string): Promise<{
  success: boolean;
  orderId: string;
  paymentUrl: string;
  invoice: Invoice;
  alreadyCreated?: boolean;
}> {
  const res = await fetch(`${API_BASE}/invoices/${invoiceId}/paypal`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.details || data.error || 'Failed to create PayPal Sandbox order');
  }
  return data;
}

export async function verifyPayment(invoiceId: string, orderId?: string): Promise<{
  success: boolean;
  payment: Payment;
  invoice: Invoice;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/invoices/${invoiceId}/verify-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.details || data.error || 'Payment verification failed');
  }
  return data;
}

export async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetch(`${API_BASE}/customers`);
  if (!res.ok) throw new Error('Failed to load customers');
  return res.json();
}

export async function createCustomer(payload: {
  name: string;
  email: string;
}): Promise<Customer & { alreadyExists?: boolean }> {
  const res = await fetch(`${API_BASE}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data.issues && data.issues[0]?.message) || data.error || 'Failed to create customer');
  }
  return data;
}

export async function fetchCustomerDetails(id: string): Promise<Customer & { invoices: Invoice[] }> {
  const res = await fetch(`${API_BASE}/customers/${id}`);
  if (!res.ok) throw new Error('Failed to load customer details');
  return res.json();
}

export async function parseInvoiceAi(prompt: string): Promise<ExtractedInvoiceDraft> {
  const res = await fetch(`${API_BASE}/ai/invoice-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.details || data.error || 'AI parsing failed');
  }
  return data;
}

export async function askFinancialChat(message: string): Promise<string> {
  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.details || data.error || 'Failed to get answer from AI');
  }
  return data.answer;
}

export async function draftPaymentReminder(
  invoiceId: string,
  tone: 'polite' | 'firm' | 'urgent'
): Promise<{ subject: string; message: string }> {
  const res = await fetch(`${API_BASE}/ai/reminder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice_id: invoiceId, tone }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.details || data.error || 'Failed to draft reminder');
  }
  return data;
}

export async function fetchActivityLogs(limit = 50): Promise<ActivityLog[]> {
  const res = await fetch(`${API_BASE}/activity?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to load activity logs');
  return res.json();
}
