import React from 'react';
import type { Invoice } from '../types.ts';
import { AlertTriangle, Trash2, Ban, ShieldAlert, X, RefreshCw } from 'lucide-react';

interface DeleteInvoiceModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteInvoiceModal: React.FC<DeleteInvoiceModalProps> = ({
  invoice,
  isOpen,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !invoice) return null;

  const isPaid =
    invoice.status === 'paid' ||
    (invoice.payments && invoice.payments.some((p) => p.status === 'COMPLETED'));
  const isDraft = invoice.status === 'draft';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
        {/* Header with Icon */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isPaid
                  ? 'bg-amber-100 text-amber-700'
                  : isDraft
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-orange-100 text-orange-700'
              }`}
            >
              {isPaid ? (
                <ShieldAlert className="w-5 h-5" />
              ) : isDraft ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <Ban className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {isPaid
                  ? 'Cannot Delete Paid Invoice'
                  : isDraft
                  ? 'Delete Draft Invoice'
                  : 'Cancel / Void Invoice'}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {invoice.invoice_number} &bull; ${invoice.total_amount.toFixed(2)}{' '}
                {invoice.currency}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invoice Summary Box */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Customer:</span>
            <span className="font-semibold text-slate-800">{invoice.customer_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Current Status:</span>
            <span className="font-semibold uppercase tracking-wider text-slate-800">
              {invoice.status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Total Amount:</span>
            <span className="font-semibold text-slate-900 font-mono">
              ${invoice.total_amount.toFixed(2)} {invoice.currency}
            </span>
          </div>
        </div>

        {/* Warning / Explanation Text */}
        <div className="text-sm text-slate-600 leading-relaxed">
          {isPaid ? (
            <p className="text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs leading-relaxed">
              <strong>Audit Protection:</strong> This invoice has recorded and verified payment
              history. Under accounting compliance standards, paid invoices cannot be permanently
              deleted to maintain an immutable audit trail.
            </p>
          ) : isDraft ? (
            <p>
              Are you sure you want to permanently delete draft invoice{' '}
              <strong className="text-slate-900">{invoice.invoice_number}</strong>? All associated
              line items will be removed. This action cannot be undone.
            </p>
          ) : (
            <p>
              Are you sure you want to void invoice{' '}
              <strong className="text-slate-900">{invoice.invoice_number}</strong>? This unpaid
              invoice will be marked as cancelled and inactive, preventing any payment while
              safely retaining record history.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {isPaid ? 'Close' : 'Cancel'}
          </button>

          {!isPaid && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 ${
                isDraft
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {isDraft ? (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Permanently Delete</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4" />
                      <span>Void Invoice</span>
                    </>
                  )}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
