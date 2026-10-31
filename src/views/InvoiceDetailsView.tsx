import React, { useState, useEffect, useRef } from 'react';
import type { Invoice, Payment } from '../types.ts';
import { getEffectiveInvoiceStatus } from '../types.ts';
import {
  fetchInvoiceById,
  createPayPalOrder,
  verifyPayment,
  draftPaymentReminder,
  deleteInvoice,
} from '../api.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { DeleteInvoiceModal } from '../components/DeleteInvoiceModal.tsx';
import { formatCurrency } from '../utils/currency.ts';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  ExternalLink,
  Copy,
  Clock,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Check,
  Pencil,
  Trash2,
} from 'lucide-react';

interface InvoiceDetailsViewProps {
  invoiceId: string;
  onBack: () => void;
  onRefreshParent: () => void;
  onEditInvoice?: (invoice: Invoice) => void;
}

export const InvoiceDetailsView: React.FC<InvoiceDetailsViewProps> = ({
  invoiceId,
  onBack,
  onRefreshParent,
  onEditInvoice,
}) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // PayPal operation state
  const [isCreatingPayPal, setIsCreatingPayPal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Auto-verification guard to prevent duplicate loops
  const autoVerifiedRef = useRef(false);

  // AI Reminder state
  const [isDraftingReminder, setIsDraftingReminder] = useState(false);
  const [reminderTone, setReminderTone] = useState<'polite' | 'firm' | 'urgent'>('polite');
  const [draftedReminder, setDraftedReminder] = useState<{ subject: string; message: string } | null>(null);
  const [copiedReminder, setCopiedReminder] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Delete / Void state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!invoice) return;
    setIsDeleting(true);
    try {
      await deleteInvoice(invoice.id);
      setIsDeleteModalOpen(false);
      onRefreshParent();
      onBack();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete invoice');
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const loadInvoice = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchInvoiceById(invoiceId);
      setInvoice(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load invoice details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    autoVerifiedRef.current = false;
    loadInvoice();
  }, [invoiceId]);

  // Notification banner when redirected back from PayPal Sandbox (Manual verification retained)
  useEffect(() => {
    if (!invoice || autoVerifiedRef.current) return;

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const paypalStatus = searchParams.get('paypal_status');

      if ((paypalStatus === 'returned' || paypalStatus === 'approved') && invoice.status !== 'paid') {
        autoVerifiedRef.current = true;
        setSuccessMessage(
          'Payment completed on PayPal. Click "Verify Payment Status" below to verify capture and update invoice status.'
        );

        // Clean query params so refresh doesn't re-trigger
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('paypal_status');
        cleanUrl.searchParams.delete('token');
        cleanUrl.searchParams.delete('PayerID');
        window.history.replaceState({}, '', cleanUrl.toString());
      } else if (paypalStatus === 'cancelled') {
        autoVerifiedRef.current = true;
        setErrorMessage('PayPal checkout was cancelled. The invoice remains unpaid.');
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('paypal_status');
        cleanUrl.searchParams.delete('token');
        cleanUrl.searchParams.delete('PayerID');
        window.history.replaceState({}, '', cleanUrl.toString());
      }
    } catch (e) {
      // ignore
    }
  }, [invoice]);

  // Handle PayPal Checkout Link Generation
  const handleGeneratePayPal = async () => {
    if (!invoice) return;
    setIsCreatingPayPal(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await createPayPalOrder(invoice.id);
      setInvoice(res.invoice);
      setSuccessMessage(
        res.alreadyCreated
          ? 'PayPal Checkout order is ready.'
          : `Created PayPal Sandbox Order ${res.orderId} successfully!`
      );
      onRefreshParent();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create PayPal Sandbox order');
    } finally {
      setIsCreatingPayPal(false);
    }
  };

  // Handle Verify & Capture Payment
  const handleVerifyPayment = async () => {
    if (!invoice) return;
    setIsVerifying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await verifyPayment(invoice.id, invoice.paypal_order_id || undefined);
      setInvoice(res.invoice);
      setSuccessMessage(res.message);
      onRefreshParent();
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Copy Payment URL
  const handleCopyLink = () => {
    if (!invoice?.payment_url) return;
    navigator.clipboard.writeText(invoice.payment_url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Handle AI Reminder
  const handleDraftReminder = async (tone: 'polite' | 'firm' | 'urgent') => {
    if (!invoice) return;
    setReminderTone(tone);
    setIsDraftingReminder(true);
    setCopiedReminder(false);

    try {
      const res = await draftPaymentReminder(invoice.id, tone);
      setDraftedReminder(res);
      setShowReminderModal(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to draft payment reminder');
    } finally {
      setIsDraftingReminder(false);
    }
  };

  const handleCopyReminder = () => {
    if (!draftedReminder) return;
    navigator.clipboard.writeText(`Subject: ${draftedReminder.subject}\n\n${draftedReminder.message}`);
    setCopiedReminder(true);
    setTimeout(() => setCopiedReminder(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading invoice details...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="font-semibold text-slate-800">Invoice not found</h3>
        <p className="text-sm text-slate-500">{errorMessage || 'The requested invoice does not exist or could not be loaded.'}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={loadInvoice}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Invoices</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {invoice.invoice_number}
              </h2>
              <StatusBadge status={getEffectiveInvoiceStatus(invoice)} />
            </div>
            <p className="text-xs text-slate-500">
              Created on {new Date(invoice.created_at).toLocaleDateString()} &bull; Due on{' '}
              <span className="font-semibold text-slate-700">{invoice.due_date}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Edit Button (for eligible unpaid invoices) */}
          {invoice.status !== 'paid' && onEditInvoice && (
            <button
              onClick={() => onEditInvoice(invoice)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              title="Edit this invoice"
            >
              <Pencil className="w-4 h-4 text-slate-500" />
              <span>Edit Invoice</span>
            </button>
          )}

          {/* Delete / Void Button - Completely hidden for Paid invoices */}
          {invoice.status !== 'paid' && (
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 shadow-xs"
              title="Delete or void invoice"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>{invoice.status === 'draft' ? 'Delete Draft' : 'Void Invoice'}</span>
            </button>
          )}

          {/* AI Reminder Button */}
          <button
            onClick={() => handleDraftReminder('polite')}
            disabled={isDraftingReminder}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>AI Reminder</span>
          </button>

          {/* If not paid: PayPal Action */}
          {invoice.status !== 'paid' && (
            <>
              {!invoice.paypal_order_id ? (
                <button
                  onClick={handleGeneratePayPal}
                  disabled={isCreatingPayPal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors disabled:opacity-50"
                >
                  {isCreatingPayPal ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Contacting PayPal...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Create PayPal Checkout Link</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleVerifyPayment}
                  disabled={isVerifying}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying with PayPal...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify Payment Status</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{successMessage}</div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Notice:</span> {errorMessage}
          </div>
        </div>
      )}

      {/* PayPal Sandbox Payment Banner (When PayPal order exists) */}
      {invoice.paypal_order_id && (
        <div className="bg-gradient-to-r from-sky-900 to-indigo-950 rounded-2xl p-5 text-white border border-sky-800 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-400/20 text-sky-200 border border-sky-400/30">
                  PayPal Sandbox Order Active
                </span>
                <span className="text-xs text-slate-300 font-mono">
                  ID: {invoice.paypal_order_id}
                </span>
              </div>
              <p className="text-sm text-slate-200">
                {invoice.status === 'paid'
                  ? 'Payment has been successfully verified & captured on PayPal Sandbox.'
                  : 'Customer can pay via the official PayPal Sandbox checkout URL below.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {invoice.payment_url && invoice.status !== 'paid' && (
                <>
                  <a
                    href={invoice.payment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-white shadow-sm transition-colors"
                  >
                    <span>Open PayPal Checkout</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </>
              )}

              {invoice.status !== 'paid' && (
                <button
                  onClick={handleVerifyPayment}
                  disabled={isVerifying}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm transition-colors disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Status</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Invoice Card Layout */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-8">
        {/* Invoice Header Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-100 pb-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Billed To
            </span>
            <div className="text-lg font-bold text-slate-900">{invoice.customer_name}</div>
            <div className="text-sm text-slate-500">{invoice.customer_email}</div>
          </div>

          <div className="md:text-right space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Invoice Summary
            </span>
            <div className="text-sm text-slate-600">
              <span className="text-slate-400">Issue Date:</span> {invoice.issue_date}
            </div>
            <div className="text-sm text-slate-600">
              <span className="text-slate-400">Due Date:</span>{' '}
              <span className="font-semibold text-slate-800">{invoice.due_date}</span>
            </div>
            <div className="text-sm text-slate-600">
              <span className="text-slate-400">Currency:</span>{' '}
              <span className="font-mono font-semibold">{invoice.currency}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        {invoice.description && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Project / Scope
            </span>
            <p className="text-sm text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
              {invoice.description}
            </p>
          </div>
        )}

        {/* Items Table */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Line Items
          </span>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Qty</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(invoice.items || []).map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{it.description}</td>
                    <td className="py-3.5 px-4 text-right text-slate-600">{it.quantity}</td>
                    <td className="py-3.5 px-4 text-right text-slate-600 font-mono">
                      {formatCurrency(it.unit_price, invoice.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono">
                      {formatCurrency(it.line_total, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Calculation Summary */}
        <div className="flex justify-end pt-2">
          <div className="w-72 space-y-2.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold font-mono">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2.5">
              <span>Total Amount:</span>
              <span className="text-blue-600 font-mono font-bold">
                {formatCurrency(invoice.total_amount, invoice.currency)}
              </span>
            </div>
            {invoice.status === 'paid' && (
              <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded border border-emerald-200 font-semibold">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Paid in Full
                </span>
                <span>{formatCurrency(invoice.total_amount, invoice.currency)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="border-t border-slate-100 pt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Payment Terms &amp; Notes
            </span>
            <p className="text-xs text-slate-600 leading-relaxed">{invoice.notes}</p>
          </div>
        )}

        {/* Verified Payment Records Table (if payments exist) */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="border-t border-slate-100 pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h4 className="font-semibold text-slate-900 text-sm">
                Verified PayPal Payment Transactions
              </h4>
            </div>
            <div className="border border-emerald-200 rounded-xl overflow-hidden bg-emerald-50/20">
              <table className="w-full text-left text-xs">
                <thead className="bg-emerald-50 text-emerald-800 font-semibold border-b border-emerald-100">
                  <tr>
                    <th className="py-2.5 px-4">Capture ID</th>
                    <th className="py-2.5 px-4">Amount</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Verified At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 font-mono">
                  {invoice.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-4 text-slate-700 font-semibold">
                        {p.paypal_capture_id || 'Manual/Simulated'}
                      </td>
                      <td className="py-2.5 px-4 text-emerald-700 font-bold">
                        {formatCurrency(p.amount, p.currency)}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 font-sans">
                        {p.verified_at ? new Date(p.verified_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* AI Payment Reminder Modal */}
      {showReminderModal && draftedReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  AI Payment Reminder (Gemini 3.8 Flash)
                </h3>
              </div>
              <button
                onClick={() => setShowReminderModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Tone Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Select Tone:</span>
              {(['polite', 'firm', 'urgent'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleDraftReminder(t)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                    reminderTone === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Subject</label>
                <input
                  type="text"
                  readOnly
                  value={draftedReminder.subject}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Message Body</label>
                <textarea
                  readOnly
                  rows={8}
                  value={draftedReminder.message}
                  className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono text-slate-700 whitespace-pre-wrap focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Ready to review and send to {invoice.customer_email}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowReminderModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  onClick={handleCopyReminder}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  {copiedReminder ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedReminder ? 'Copied to Clipboard!' : 'Copy Reminder'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteInvoiceModal
        invoice={invoice}
        isOpen={isDeleteModalOpen}
        isDeleting={isDeleting}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
