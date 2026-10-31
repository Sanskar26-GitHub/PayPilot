import { z } from 'zod';

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
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
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

export interface ActivityLog {
  id: string;
  invoice_id: string | null;
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

// Zod Validation Schemas
export const LineItemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit_price: z.number().min(0, 'Unit price must be non-negative'),
});

export const CreateInvoiceSchema = z
  .object({
    customer_name: z.string().min(1, 'Customer name is required'),
    customer_email: z.string().email('Valid customer email is required'),
    description: z.string().default('Services rendered'),
    currency: z.string().length(3).default('USD'),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Issue date must be YYYY-MM-DD'),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD'),
    notes: z.string().optional().default(''),
    items: z.array(LineItemSchema).min(1, 'At least one line item is required'),
    is_draft: z.boolean().optional().default(true),
  })
  .refine((data) => data.due_date >= data.issue_date, {
    message: 'Due date cannot be earlier than issue date.',
    path: ['due_date'],
  });

export const CreateCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(150),
  email: z.string().trim().email('Valid customer email is required').max(150),
});

export const UpdateDraftSchema = z
  .object({
    customer_name: z.string().min(1).optional(),
    customer_email: z.string().email().optional(),
    description: z.string().optional(),
    currency: z.string().length(3).optional(),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().optional(),
    items: z.array(LineItemSchema).min(1).optional(),
    status: z.enum(['draft', 'created']).optional(),
  })
  .refine(
    (data) => {
      if (data.issue_date && data.due_date) {
        return data.due_date >= data.issue_date;
      }
      return true;
    },
    {
      message: 'Due date cannot be earlier than issue date.',
      path: ['due_date'],
    }
  );

export const UpdateInvoiceSchema = z
  .object({
    customer_name: z.string().trim().min(1, 'Customer name is required').optional(),
    customer_email: z.string().trim().email('Valid customer email is required').optional(),
    description: z.string().trim().min(1).optional(),
    currency: z.string().length(3).optional(),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Issue date must be YYYY-MM-DD').optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD').optional(),
    notes: z.string().optional(),
    items: z.array(LineItemSchema).min(1, 'At least one line item is required').optional(),
    status: z.enum(['draft', 'created', 'sent']).optional(),
  })
  .refine(
    (data) => {
      if (data.issue_date && data.due_date) {
        return data.due_date >= data.issue_date;
      }
      return true;
    },
    {
      message: 'Due date cannot be earlier than issue date.',
      path: ['due_date'],
    }
  );

export const AiParseInvoiceSchema = z.object({
  prompt: z.string().min(3, 'Please provide an invoice description'),
});

export const AiChatSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
});

export const AiReminderSchema = z.object({
  invoice_id: z.string().uuid('Valid invoice ID required'),
  tone: z.enum(['polite', 'firm', 'urgent']).default('polite'),
});

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
