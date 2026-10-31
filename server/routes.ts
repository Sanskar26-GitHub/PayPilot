import { Router, Request, Response } from 'express';
import { db } from './db.ts';
import { paypal } from './paypal.ts';
import { gemini } from './gemini.ts';
import {
  CreateInvoiceSchema,
  UpdateDraftSchema,
  UpdateInvoiceSchema,
  CreateCustomerSchema,
  AiParseInvoiceSchema,
  AiChatSchema,
  AiReminderSchema,
} from './types.ts';

export const apiRouter = Router();

// In-memory deduplication cache to prevent duplicate invoices from rapid double-clicks or retries
const recentSubmissions = new Map<string, { invoice: any; timestamp: number }>();
function cleanupRecentSubmissions() {
  const cutoff = Date.now() - 30000;
  for (const [key, val] of recentSubmissions.entries()) {
    if (val.timestamp < cutoff) recentSubmissions.delete(key);
  }
}

// 1. Health check
apiRouter.get('/health', async (_req: Request, res: Response) => {
  const dbStatus = db.getStatus();
  const paypalStatus = await paypal.getStatus();
  const geminiStatus = gemini.getStatus();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus.isConnected ? 'healthy' : 'fallback',
      paypal: paypalStatus.reachable ? 'connected' : paypalStatus.isConfigured ? 'unreachable' : 'not_configured',
      gemini: geminiStatus.isConfigured ? 'available' : 'not_configured',
    },
  });
});

// 2. Integration Status
apiRouter.get('/integrations/status', async (req: Request, res: Response) => {
  const shouldRecheck = req.query.recheck === 'true';
  const dbStatus = shouldRecheck ? await db.recheckConnection() : db.getStatus();
  const paypalStatus = await paypal.getStatus();
  const geminiStatus = gemini.getStatus();

  res.json({
    database: {
      configured: dbStatus.isConfigured,
      connected: dbStatus.isConnected,
      provider: dbStatus.provider,
      databaseName: dbStatus.databaseName,
      host: dbStatus.host,
      error: dbStatus.error,
    },
    paypal: {
      configured: paypalStatus.isConfigured,
      reachable: paypalStatus.reachable,
      baseUrl: paypalStatus.baseUrl,
      clientIdMasked: paypalStatus.clientIdMasked,
      mode: 'sandbox',
      error: paypalStatus.error,
    },
    gemini: {
      configured: geminiStatus.isConfigured,
      model: geminiStatus.model,
      error: geminiStatus.error,
    },
  });
});

// 3. Dashboard Metrics
apiRouter.get('/dashboard/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await db.getDashboardMetrics();
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compute dashboard metrics', details: err.message });
  }
});

// 4. Invoices List
apiRouter.get('/invoices', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const invoices = await db.getInvoices({ status, search });
    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve invoices', details: err.message });
  }
});

// 5. Create Invoice
apiRouter.post('/invoices', async (req: Request, res: Response) => {
  const dbStatus = db.getStatus();
  console.info(`[PayPilot API] POST /invoices (provider: ${dbStatus.provider}, is_draft: ${Boolean(req.body?.is_draft)})`);
  try {
    const parsed = CreateInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn('[PayPilot API] POST /invoices validation failed:', parsed.error.issues);
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Validation failed',
        issues: parsed.error.issues,
      });
    }

    // Check for rapid duplicate submission (e.g. double click or network retry within 3 seconds)
    const idempotencyHeader = req.headers['idempotency-key'] as string | undefined;
    const itemsSummary = (parsed.data.items || []).map((i) => `${i.description}:${i.quantity}:${i.unit_price}`).join('|');
    const dedupKey = idempotencyHeader || `${parsed.data.customer_email}:${parsed.data.issue_date}:${parsed.data.due_date}:${parsed.data.currency}:${itemsSummary}:${Boolean(parsed.data.is_draft)}`;

    cleanupRecentSubmissions();
    const existingSubmission = recentSubmissions.get(dedupKey);
    if (existingSubmission && Date.now() - existingSubmission.timestamp < 3000) {
      console.info(`[PayPilot API] Returning existing invoice for duplicate submission key: ${dedupKey}`);
      return res.status(200).json(existingSubmission.invoice);
    }

    const invoice = await db.createInvoice(parsed.data);
    recentSubmissions.set(dedupKey, { invoice, timestamp: Date.now() });

    console.info(`[PayPilot API] Invoice created successfully: id=${invoice.id}, num=${invoice.invoice_number}, status=${invoice.status}`);
    res.status(201).json(invoice);
  } catch (err: any) {
    console.error('[PayPilot API] Failed to create invoice:', err.message);
    res.status(500).json({ error: 'Failed to create invoice', details: err.message });
  }
});

// 6. Get Invoice by ID
apiRouter.get('/invoices/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const dbStatus = db.getStatus();
  console.info(`[PayPilot API] GET /invoices/${id} (provider: ${dbStatus.provider}, connected: ${dbStatus.isConnected})`);
  try {
    const invoice = await db.getInvoiceById(id);
    if (!invoice) {
      console.warn(`[PayPilot API] Invoice "${id}" not found in ${dbStatus.provider} store`);
      return res.status(404).json({ error: 'Invoice not found', requestedId: id });
    }
    console.info(`[PayPilot API] Invoice "${id}" found: num=${invoice.invoice_number}, status=${invoice.status}`);
    res.json(invoice);
  } catch (err: any) {
    console.error(`[PayPilot API] Failed to fetch invoice "${id}":`, err.message);
    res.status(500).json({ error: 'Failed to fetch invoice', details: err.message, requestedId: id });
  }
});

// 7. Update Invoice (Draft or Unpaid Issued)
const handleUpdateInvoice = async (req: Request, res: Response) => {
  try {
    const parsed = UpdateInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Validation failed',
        issues: parsed.error.issues,
      });
    }

    const updated = await db.updateInvoice(req.params.id, parsed.data);
    res.json(updated);
  } catch (err: any) {
    const statusCode = err.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({ error: err.message });
  }
};

apiRouter.patch('/invoices/:id', handleUpdateInvoice);
apiRouter.put('/invoices/:id', handleUpdateInvoice);

// 8. Delete or Void Invoice
apiRouter.delete('/invoices/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await db.deleteInvoice(id);
    console.info(`[PayPilot API] Invoice "${id}" ${result.action} successfully`);
    res.json(result);
  } catch (err: any) {
    console.warn(`[PayPilot API] Failed to delete invoice "${id}":`, err.message);
    const statusCode = err.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({ error: err.message });
  }
});

// 9. Explicit Void / Cancel Invoice
apiRouter.post('/invoices/:id/void', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const updated = await db.voidInvoice(id);
    console.info(`[PayPilot API] Invoice "${id}" voided successfully`);
    res.json(updated);
  } catch (err: any) {
    console.warn(`[PayPilot API] Failed to void invoice "${id}":`, err.message);
    const statusCode = err.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({ error: err.message });
  }
});

// 8. Create PayPal Sandbox Order / Link for Invoice
apiRouter.post('/invoices/:id/paypal', async (req: Request, res: Response) => {
  try {
    const invoice = await db.getInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice is already marked as paid.' });
    }

    // If order already created and active, return existing link to avoid duplicates
    if (invoice.paypal_order_id && invoice.payment_url) {
      return res.json({
        success: true,
        orderId: invoice.paypal_order_id,
        paymentUrl: invoice.payment_url,
        invoice,
        alreadyCreated: true,
      });
    }

    if (!paypal.isConfigured()) {
      return res.status(400).json({
        error: 'PayPal Sandbox is not configured.',
        setupRequired: true,
        instructions:
          'Please configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in the Settings > Secrets panel or environment variables.',
      });
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const returnUrl = `${baseUrl}/api/paypal/return?invoice_id=${encodeURIComponent(invoice.id)}`;
    const cancelUrl = `${baseUrl}/api/paypal/cancel?invoice_id=${encodeURIComponent(invoice.id)}`;

    const orderResult = await paypal.createOrderForInvoice(invoice, returnUrl, cancelUrl);

    // Update invoice record: Transition draft or created invoice to 'sent' once payment link is generated
    const newStatus =
      invoice.status === 'draft' || invoice.status === 'created' ? 'sent' : invoice.status;

    const updatedInvoice = await db.updateInvoicePayPalInfo(invoice.id, {
      paypal_order_id: orderResult.orderId,
      payment_url: orderResult.approvalUrl,
      status: newStatus,
    });

    await db.logActivity({
      invoice_id: invoice.id,
      event_type: 'PAYPAL_ORDER_CREATED',
      description: `Generated PayPal Sandbox checkout order ${orderResult.orderId} for ${invoice.invoice_number}`,
      metadata: { order_id: orderResult.orderId, approval_url: orderResult.approvalUrl },
    });

    res.json({
      success: true,
      orderId: orderResult.orderId,
      paymentUrl: orderResult.approvalUrl,
      invoice: updatedInvoice,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create PayPal Sandbox order', details: err.message });
  }
});

// 8b. PayPal Return Redirect Handler (Prevents 404 on returning from PayPal Sandbox)
apiRouter.get('/paypal/return', (req: Request, res: Response) => {
  const invoiceId = req.query.invoice_id || req.query.id || '';
  const token = req.query.token || '';
  const payerId = req.query.PayerID || '';

  const params = new URLSearchParams();
  params.set('view', 'invoice-details');
  if (invoiceId) params.set('id', String(invoiceId));
  params.set('paypal_status', 'returned');
  if (token) params.set('token', String(token));
  if (payerId) params.set('PayerID', String(payerId));

  res.redirect(`/?${params.toString()}`);
});

// 8c. PayPal Cancel Redirect Handler
apiRouter.get('/paypal/cancel', (req: Request, res: Response) => {
  const invoiceId = req.query.invoice_id || req.query.id || '';
  const token = req.query.token || '';

  const params = new URLSearchParams();
  params.set('view', 'invoice-details');
  if (invoiceId) params.set('id', String(invoiceId));
  params.set('paypal_status', 'cancelled');
  if (token) params.set('token', String(token));

  res.redirect(`/?${params.toString()}`);
});

// 9. Verify & Capture PayPal Payment
apiRouter.post('/invoices/:id/verify-payment', async (req: Request, res: Response) => {
  try {
    const invoice = await db.getInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Idempotency: If already paid, return recorded payment without re-capturing
    if (invoice.status === 'paid') {
      const existingPayment = await db.getPaymentByInvoiceId(invoice.id);
      return res.json({
        success: true,
        verified: true,
        payment: existingPayment,
        invoice,
        alreadyPaid: true,
        message: 'Payment has already been verified and recorded for this invoice.',
      });
    }

    const orderId = req.body.orderId || invoice.paypal_order_id;
    if (!orderId) {
      return res.status(400).json({
        error: 'No PayPal Order ID associated with this invoice to verify.',
      });
    }

    if (invoice.paypal_order_id && orderId !== invoice.paypal_order_id) {
      return res.status(400).json({
        error: 'Provided PayPal Order ID does not match the invoice PayPal order.',
      });
    }

    if (!paypal.isConfigured()) {
      return res.status(400).json({
        error: 'PayPal Sandbox is not configured.',
        setupRequired: true,
      });
    }

    // Call PayPal Sandbox API to verify order and capture funds
    const captureResult = await paypal.verifyAndCaptureOrder(orderId);

    // Validate captured currency and amount
    if (captureResult.currency.toUpperCase() !== invoice.currency.toUpperCase()) {
      return res.status(400).json({
        error: `Captured payment currency (${captureResult.currency}) does not match invoice currency (${invoice.currency}).`,
      });
    }

    if (Math.abs(captureResult.amount - invoice.total_amount) > 0.01) {
      return res.status(400).json({
        error: `Captured payment amount ($${captureResult.amount.toFixed(2)}) does not match invoice total ($${invoice.total_amount.toFixed(2)}).`,
      });
    }

    // Record verified payment in database transaction
    const payment = await db.recordVerifiedPayment({
      invoice_id: invoice.id,
      paypal_order_id: captureResult.orderId,
      paypal_capture_id: captureResult.captureId,
      amount: captureResult.amount,
      currency: captureResult.currency,
      status: captureResult.status,
    });

    const refreshedInvoice = await db.getInvoiceById(invoice.id);

    res.json({
      success: true,
      verified: true,
      payment,
      invoice: refreshedInvoice,
      message: `Payment of $${captureResult.amount.toFixed(2)} ${captureResult.currency} verified successfully via PayPal Sandbox!`,
    });
  } catch (err: any) {
    res.status(400).json({
      error: 'Payment verification failed',
      details: err.message,
    });
  }
});

// 10. Customers
apiRouter.get('/customers', async (_req: Request, res: Response) => {
  try {
    const customers = await db.getCustomers();
    res.json(customers);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve customers', details: err.message });
  }
});

apiRouter.post('/customers', async (req: Request, res: Response) => {
  try {
    const parsed = CreateCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Validation failed',
        issues: parsed.error.issues,
      });
    }

    const customer = await db.createCustomer(parsed.data.name, parsed.data.email);
    const statusCode = customer.alreadyExists ? 200 : 201;
    res.status(statusCode).json(customer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/customers/:id', async (req: Request, res: Response) => {
  try {
    const customer = await db.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const allInvoices = await db.getInvoices();
    const customerInvoices = allInvoices.filter((i) => i.customer_id === customer.id);
    res.json({
      ...customer,
      invoices: customerInvoices,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve customer details', details: err.message });
  }
});

// 11. AI: Parse Invoice Prompt
apiRouter.post('/ai/invoice-draft', async (req: Request, res: Response) => {
  try {
    const parsed = AiParseInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid prompt', issues: parsed.error.issues });
    }

    const draft = await gemini.parseInvoicePrompt(parsed.data.prompt);
    res.json(draft);
  } catch (err: any) {
    res.status(500).json({ error: 'AI invoice extraction failed', details: err.message });
  }
});

// 12. AI: Grounded Financial Chat
apiRouter.post('/ai/chat', async (req: Request, res: Response) => {
  try {
    const parsed = AiChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid message', issues: parsed.error.issues });
    }

    const answer = await gemini.answerFinancialChat(parsed.data.message);
    res.json({ answer });
  } catch (err: any) {
    res.status(500).json({ error: 'AI Assistant failed to generate response', details: err.message });
  }
});

// 13. AI: Draft Payment Reminder
apiRouter.post('/ai/reminder', async (req: Request, res: Response) => {
  try {
    const parsed = AiReminderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid reminder request', issues: parsed.error.issues });
    }

    const reminder = await gemini.draftReminder(parsed.data.invoice_id, parsed.data.tone);
    res.json(reminder);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to draft reminder', details: err.message });
  }
});

// 14. Activity Log
apiRouter.get('/activity', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const logs = await db.getActivityLogs(limit);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve activity log', details: err.message });
  }
});
