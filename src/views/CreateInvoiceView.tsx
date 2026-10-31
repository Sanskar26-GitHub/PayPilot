import React, { useState, useEffect } from 'react';
import { parseInvoiceAi, createInvoice, updateInvoice, fetchCustomers } from '../api.ts';
import type { Invoice, InvoiceItem, Customer } from '../types.ts';
import { formatCurrency, SUPPORTED_CURRENCIES } from '../utils/currency.ts';
import {
  Sparkles,
  FileText,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Info,
  Edit,
  ShieldAlert,
} from 'lucide-react';

interface CreateInvoiceViewProps {
  onSuccess: (invoiceId: string) => void;
  onCancel: () => void;
  initialInvoice?: Invoice | null;
  prefilledCustomer?: { name: string; email: string } | null;
}

export const CreateInvoiceView: React.FC<CreateInvoiceViewProps> = ({
  onSuccess,
  onCancel,
  initialInvoice,
  prefilledCustomer,
}) => {
  const isEditing = Boolean(initialInvoice);
  const [mode, setMode] = useState<'ai' | 'manual'>(isEditing ? 'manual' : 'ai');

  // Registered customers list for quick selection
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    fetchCustomers()
      .then((data) => setExistingCustomers(data))
      .catch(() => {});
  }, []);

  // AI Prompt State - Starts blank by default
  const [aiPrompt, setAiPrompt] = useState('');
  const [isParsingAi, setIsParsingAi] = useState(false);
  const [aiClarifications, setAiClarifications] = useState<string[]>([]);

  // Form Fields Initialization - Starts completely blank by default for new invoices
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultDueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  const [customerName, setCustomerName] = useState(
    initialInvoice?.customer_name || prefilledCustomer?.name || ''
  );
  const [customerEmail, setCustomerEmail] = useState(
    initialInvoice?.customer_email || prefilledCustomer?.email || ''
  );
  const [description, setDescription] = useState(
    initialInvoice?.description || ''
  );
  const [currency, setCurrency] = useState(initialInvoice?.currency || 'USD');
  const [issueDate, setIssueDate] = useState(
    initialInvoice?.issue_date?.split('T')[0] || todayStr
  );
  const [dueDate, setDueDate] = useState(
    initialInvoice?.due_date?.split('T')[0] || defaultDueDate
  );
  const [notes, setNotes] = useState(
    initialInvoice?.notes || 'Payment terms: Due upon receipt. Powered by PayPal Sandbox.'
  );

  const [items, setItems] = useState<InvoiceItem[]>(() => {
    if (initialInvoice?.items && initialInvoice.items.length > 0) {
      return initialInvoice.items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || 0,
        line_total: Number(it.line_total) || 0,
      }));
    }
    // Blank line item by default for new invoice creation
    return [
      {
        description: '',
        quantity: 1,
        unit_price: 0,
        line_total: 0,
      },
    ];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Recalculate line total and grand total
  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    const qty = Number(current.quantity) || 0;
    const price = Number(current.unit_price) || 0;
    current.line_total = Math.round(qty * price * 100) / 100;

    updated[index] = current;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: '',
        quantity: 1,
        unit_price: 0,
        line_total: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, it) => sum + (Number(it.line_total) || 0), 0);
  };

  const subtotal = calculateSubtotal();
  const totalAmount = subtotal;

  // Handle Quick Customer Selection
  const handleSelectExistingCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) return;
    const found = existingCustomers.find((c) => c.id === selectedId);
    if (found) {
      setCustomerName(found.name);
      setCustomerEmail(found.email);
    }
  };

  // Handle AI Prompt Submit
  const handleParsePrompt = async () => {
    if (!aiPrompt.trim()) return;
    setIsParsingAi(true);
    setErrorMessage(null);
    setAiClarifications([]);

    try {
      const extracted = await parseInvoiceAi(aiPrompt);
      setCustomerName(extracted.customer_name);
      setCustomerEmail(extracted.customer_email || '');
      setDescription(extracted.description);
      setCurrency(extracted.currency);
      setIssueDate(extracted.issue_date);
      setDueDate(
        extracted.due_date >= extracted.issue_date ? extracted.due_date : extracted.issue_date
      );
      if (extracted.notes) setNotes(extracted.notes);

      if (extracted.items && extracted.items.length > 0) {
        setItems(extracted.items);
      }

      if (extracted.clarifications_needed && extracted.clarifications_needed.length > 0) {
        setAiClarifications(extracted.clarifications_needed);
      }

      // Switch to manual review mode
      setMode('manual');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to extract invoice from prompt.');
    } finally {
      setIsParsingAi(false);
    }
  };

  // Handle Save (Create or Update)
  const handleSaveInvoice = async (isDraft: boolean) => {
    setErrorMessage(null);

    // Validation
    if (!customerName.trim()) {
      setErrorMessage('Please provide a customer name.');
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setErrorMessage('Please provide a valid customer email address.');
      return;
    }
    // Bug 1: Validate date sequence
    if (dueDate < issueDate) {
      setErrorMessage('Due date cannot be earlier than issue date.');
      return;
    }
    if (items.length === 0) {
      setErrorMessage('Invoice must contain at least one line item.');
      return;
    }
    for (const it of items) {
      if (!it.description.trim()) {
        setErrorMessage('All line items must have a description.');
        return;
      }
      if (it.quantity <= 0) {
        setErrorMessage('Line item quantity must be greater than zero.');
        return;
      }
      if (it.unit_price < 0) {
        setErrorMessage('Line item unit price cannot be negative.');
        return;
      }
    }
    if (totalAmount <= 0) {
      setErrorMessage('Invoice total must be greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && initialInvoice) {
        // Updating existing invoice
        const updated = await updateInvoice(initialInvoice.id, {
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim(),
          description: description.trim(),
          currency: currency.toUpperCase(),
          issue_date: issueDate,
          due_date: dueDate,
          notes: notes.trim(),
          items: items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unit_price,
          })),
          status: isDraft ? 'draft' : initialInvoice.status === 'draft' ? 'created' : undefined,
        });

        onSuccess(updated.id);
      } else {
        // Creating new invoice
        const created = await createInvoice({
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim(),
          description: description.trim(),
          currency: currency.toUpperCase(),
          issue_date: issueDate,
          due_date: dueDate,
          notes: notes.trim(),
          items: items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unit_price,
          })),
          is_draft: isDraft,
        });

        onSuccess(created.id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasActivePaymentLink = Boolean(
    initialInvoice && (initialInvoice.payment_url || initialInvoice.paypal_order_id)
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isEditing ? `Edit Invoice (${initialInvoice?.invoice_number})` : 'Create Invoice'}
            </h2>
            {isEditing && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Edit className="w-3.5 h-3.5" />
                Editing Mode
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {isEditing
              ? 'Update invoice line items, dates, terms, or customer details.'
              : 'Generate invoice drafts with Gemini AI or enter details manually.'}
          </p>
        </div>

        {/* Mode Selector (Only shown when creating new invoice) */}
        {!isEditing && (
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs font-semibold shadow-xs">
            <button
              onClick={() => setMode('ai')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                mode === 'ai' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Prompt</span>
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                mode === 'manual' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Standard Form</span>
            </button>
          </div>
        )}
      </div>

      {/* Payment Link Invalidation Notice for Issued Invoices */}
      {hasActivePaymentLink && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs sm:text-sm">
            <span className="font-semibold text-amber-950">Payment Link Safety Notice:</span> This
            invoice currently has an active PayPal checkout link. Modifying items, amounts, or
            currency will safely invalidate the old link so the customer cannot be charged an
            outdated amount. You can generate a fresh PayPal link after saving.
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Notice:</span> {errorMessage}
          </div>
        </div>
      )}

      {/* Clarification notices from AI */}
      {aiClarifications.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm space-y-1">
          <div className="font-semibold flex items-center gap-1.5 text-amber-800">
            <Info className="w-4 h-4 text-amber-600" />
            AI Extraction Review Notice
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-1 text-amber-800">
            {aiClarifications.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Extraction Mode Container (Only when creating and in AI mode) */}
      {!isEditing && mode === 'ai' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Natural-Language Invoice Extraction (Gemini 3.8 Flash)</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Type or paste your billing instruction in natural English. Gemini will automatically
            extract customer details, line items, quantities, dates, and amounts into an editable
            structured draft for your review.
          </p>

          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={4}
            className="w-full p-3.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="e.g. Create an invoice for Rahul Sharma (rahul.sharma@example.com) for 450 Euro for React dashboard development, due 7 days from today..."
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-medium text-slate-600">Example templates:</span>
              <button
                type="button"
                onClick={() =>
                  setAiPrompt(
                    'Create an invoice for Rahul Mehta (rahul.mehta@example.com) for website development services. Include frontend website development, backend API integration, and website testing. Charge 2 units of frontend development at $200 per unit, 1 unit of backend API integration at $150, and 1 unit of website testing at $100. Set the issue date to today and due date to 7 days from today.'
                  )
                }
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                Website Development
              </button>
              <span>&bull;</span>
              <button
                type="button"
                onClick={() =>
                  setAiPrompt(
                    'Create an invoice for Priya Sharma (priya.sharma@example.com) for mobile application development services. Include iOS app development, Android app development, and QA testing. Charge 2 units of iOS development at $250 per unit, 1 unit of Android development at $175, and 1 unit of QA testing at $75. Set the issue date to today and due date to 14 days from today.'
                  )
                }
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                Mobile App Development
              </button>
            </div>

            <button
              onClick={handleParsePrompt}
              disabled={isParsingAi || !aiPrompt.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
            >
              {isParsingAi ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Extracting with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Structured Draft</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Structured Invoice Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 text-base">
            {isEditing ? 'Invoice Information' : 'Invoice Draft Details'}
          </h3>
          <span className="text-xs text-slate-400">
            {isEditing ? 'Save changes to persist to database' : 'Review and adjust before saving'}
          </span>
        </div>

        {/* Existing customer quick-selector */}
        {existingCustomers.length > 0 && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs text-slate-600 font-medium">
              Choose existing client (optional):
            </span>
            <select
              onChange={handleSelectExistingCustomer}
              defaultValue=""
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select from {existingCustomers.length} registered clients --</option>
              {existingCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Customer Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Customer Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Customer Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="e.g. rahul@example.com"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Description & Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Invoice Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Web Development & Consulting"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Issue Date</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Due Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`w-full px-3.5 py-2 rounded-lg border text-sm focus:ring-2 focus:outline-none ${
                dueDate < issueDate
                  ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-rose-400'
                  : 'border-slate-200 focus:ring-blue-500'
              }`}
            />
            {dueDate < issueDate && (
              <p className="text-xs text-rose-600 mt-1 font-medium">
                Due date cannot be earlier than issue date.
              </p>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Line Items
            </label>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Line Item</span>
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl bg-slate-50 border border-slate-200/80"
              >
                <div className="col-span-12 sm:col-span-6">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    placeholder="Item description or service..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    placeholder="Qty"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-5 sm:col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                    placeholder="Price"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-3 sm:col-span-2 flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-slate-800">
                    {formatCurrency(item.line_total, currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={items.length <= 1}
                    className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subtotal & Total */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2">
              <span>Grand Total:</span>
              <span className="text-blue-600 font-bold">
                {formatCurrency(totalAmount, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Customer Notes &amp; Payment Terms
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Add payment instructions, terms, or notes..."
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                {initialInvoice?.status === 'draft' && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSaveInvoice(true)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Save Draft Changes
                  </button>
                )}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSaveInvoice(false)}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {initialInvoice?.status === 'draft' ? 'Save & Issue' : 'Save Changes'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSaveInvoice(true)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSaveInvoice(false)}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>Create &amp; Issue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
