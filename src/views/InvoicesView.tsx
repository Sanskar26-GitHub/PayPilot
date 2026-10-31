import React, { useState } from 'react';
import type { Invoice } from '../types.ts';
import { isInvoiceOverdue, getEffectiveInvoiceStatus } from '../types.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { DeleteInvoiceModal } from '../components/DeleteInvoiceModal.tsx';
import { deleteInvoice } from '../api.ts';
import { formatCurrency } from '../utils/currency.ts';
import {
  Search,
  Filter,
  Plus,
  Eye,
  ExternalLink,
  CreditCard,
  CheckCircle,
  FileText,
  Calendar,
  AlertCircle,
  Pencil,
  Trash2,
} from 'lucide-react';

interface InvoicesViewProps {
  invoices: Invoice[];
  isLoading: boolean;
  onNavigate: (tab: any, invoiceId?: string) => void;
  onRefresh: () => void;
  onEditInvoice?: (invoice: Invoice) => void;
}

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All Invoices', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Sent', value: 'sent' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Draft', value: 'draft' },
  { label: 'Created', value: 'created' },
];

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  isLoading,
  onNavigate,
  onRefresh,
  onEditInvoice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null
  );

  const today = new Date().toISOString().split('T')[0];

  const filteredInvoices = invoices.filter((inv) => {
    let matchesStatus = true;
    if (selectedStatus !== 'all') {
      const norm = selectedStatus.toLowerCase();
      if (norm === 'overdue') {
        matchesStatus = isInvoiceOverdue(inv, today);
      } else if (norm === 'created') {
        matchesStatus = inv.status.toLowerCase() === 'created' && !isInvoiceOverdue(inv, today);
      } else if (norm === 'sent') {
        matchesStatus =
          (inv.status.toLowerCase() === 'sent' || Boolean(inv.payment_url)) &&
          !isInvoiceOverdue(inv, today) &&
          inv.status.toLowerCase() !== 'paid';
      } else if (norm === 'paid') {
        matchesStatus = inv.status.toLowerCase() === 'paid';
      } else if (norm === 'draft') {
        matchesStatus = inv.status.toLowerCase() === 'draft';
      } else {
        matchesStatus = inv.status.toLowerCase() === norm;
      }
    }

    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      inv.invoice_number.toLowerCase().includes(term) ||
      (inv.customer_name && inv.customer_name.toLowerCase().includes(term)) ||
      (inv.customer_email && inv.customer_email.toLowerCase().includes(term)) ||
      (inv.description && inv.description.toLowerCase().includes(term));

    return matchesStatus && matchesSearch;
  });

  const handleDeleteClick = (inv: Invoice) => {
    setInvoiceToDelete(inv);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;
    setIsDeleting(true);
    try {
      const result = await deleteInvoice(invoiceToDelete.id);
      setIsDeleteModalOpen(false);
      setInvoiceToDelete(null);
      setNotification({
        type: 'success',
        message:
          result.action === 'deleted'
            ? `Draft invoice ${result.invoice_number} deleted permanently.`
            : `Invoice ${result.invoice_number} voided and marked inactive.`,
      });
      onRefresh();
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to delete invoice.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Invoices</h2>
          <p className="text-sm text-slate-500">
            Create, track, and collect client invoices with verified PayPal payments.
          </p>
        </div>
        <button
          onClick={() => onNavigate('create-invoice')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Invoice</span>
        </button>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-start gap-3 animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{notification.message}</div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by invoice number, customer, or description..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setSelectedStatus(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedStatus === f.value
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading invoice records...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-700 mb-1">No invoices found</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto mb-4">
              {searchTerm || selectedStatus !== 'all'
                ? 'No invoices match your current search or status filter criteria.'
                : 'Get started by creating your first invoice manually or with the Gemini AI assistant.'}
            </p>
            <button
              onClick={() => onNavigate('create-invoice')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Create Invoice</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Invoice #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Issue Date</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const isPaid =
                    inv.status === 'paid' ||
                    (inv.payments && inv.payments.some((p) => p.status === 'COMPLETED'));
                  const canEdit = !isPaid && inv.status !== 'cancelled' && inv.status !== 'failed';

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      onClick={() => onNavigate('invoice-details', inv.id)}
                    >
                      <td className="py-4 px-4 sm:px-6">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {inv.invoice_number}
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-[180px]">
                          {inv.description || 'Professional Services'}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-medium text-slate-800">
                          {inv.customer_name || 'Unassigned'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {inv.customer_email || 'No email provided'}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-slate-600 text-xs">{inv.issue_date}</td>

                      <td className="py-4 px-4 text-xs font-medium">
                        <span
                          className={
                            isInvoiceOverdue(inv, today)
                              ? 'text-rose-600 font-semibold'
                              : 'text-slate-600'
                          }
                        >
                          {inv.due_date}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-900">
                          {formatCurrency(inv.total_amount, inv.currency)}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <StatusBadge status={getEffectiveInvoiceStatus(inv, today)} />
                      </td>

                      <td className="py-4 px-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1 justify-end">
                          {/* View details */}
                          <button
                            onClick={() => onNavigate('invoice-details', inv.id)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit Invoice (eligible unpaid invoices) */}
                          {canEdit && (
                            <button
                              onClick={() => {
                                if (onEditInvoice) {
                                  onEditInvoice(inv);
                                } else {
                                  onNavigate('create-invoice', inv.id);
                                }
                              }}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="Edit Invoice"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}

                          {/* PayPal Link shortcut if active */}
                          {inv.payment_url && inv.status !== 'paid' && (
                            <a
                              href={inv.payment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-md transition-colors"
                              title="Open PayPal Sandbox Checkout"
                            >
                              <CreditCard className="w-4 h-4" />
                            </a>
                          )}

                          {/* Delete / Void Invoice - Completely hidden for Paid invoices */}
                          {!isPaid && (
                            <button
                              onClick={() => handleDeleteClick(inv)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title={inv.status === 'draft' ? 'Delete Draft' : 'Void Invoice'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Showing {filteredInvoices.length} of {invoices.length} invoices</span>
          <span className="hidden sm:inline">PayPal Sandbox payments must be verified to mark invoices paid</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteInvoiceModal
        invoice={invoiceToDelete}
        isOpen={isDeleteModalOpen}
        isDeleting={isDeleting}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setInvoiceToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
