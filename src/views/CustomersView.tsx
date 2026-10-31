import React, { useState, useEffect } from 'react';
import type { Customer, Invoice } from '../types.ts';
import { fetchCustomers, fetchCustomerDetails } from '../api.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { AddCustomerModal } from '../components/AddCustomerModal.tsx';
import { formatCurrency } from '../utils/currency.ts';
import {
  Users,
  Search,
  DollarSign,
  FileText,
  Mail,
  ChevronRight,
  ExternalLink,
  X,
  CreditCard,
  UserPlus,
  CheckCircle,
  Plus,
} from 'lucide-react';

interface CustomersViewProps {
  onNavigateInvoice: (invoiceId: string) => void;
  onNavigateCreateForCustomer: (name: string, email: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  onNavigateInvoice,
  onNavigateCreateForCustomer,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<(Customer & { invoices: Invoice[] }) | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCustomers();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSelectCustomer = async (id: string) => {
    setSelectedCustomerId(id);
    setIsLoadingDetails(true);
    try {
      const data = await fetchCustomerDetails(id);
      setCustomerDetails(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleCustomerAdded = (customer: Customer, alreadyExisted?: boolean) => {
    setIsAddModalOpen(false);
    loadCustomers();
    setSuccessNotification(
      alreadyExisted
        ? `Customer "${customer.name}" (${customer.email}) was already registered.`
        : `Customer "${customer.name}" (${customer.email}) created successfully!`
    );
    setTimeout(() => {
      setSuccessNotification(null);
    }, 4000);
  };

  const filtered = customers.filter((c) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term);
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Customers</h2>
          <p className="text-sm text-slate-500">
            Client accounts, cumulative invoiced totals, and verified payment history.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>New Customer</span>
        </button>
      </div>

      {/* Success Notification */}
      {successNotification && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3 animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{successNotification}</div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customers by name or email..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Customers Table / Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading customers...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-700 mb-1">No customers found</h3>
            <p className="text-sm text-slate-400">
              Customers are automatically created and tracked when you generate invoices.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Customer</th>
                  <th className="py-3.5 px-4 text-center">Invoices</th>
                  <th className="py-3.5 px-4">Total Invoiced</th>
                  <th className="py-3.5 px-4">Paid Amount</th>
                  <th className="py-3.5 px-4">Outstanding</th>
                  <th className="py-3.5 px-4 text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleSelectCustomer(c.id)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-4 sm:px-6">
                      <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {c.name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.email}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {c.invoice_count || 0}
                      </span>
                    </td>

                    <td className="py-4 px-4 font-mono font-medium text-slate-800">
                      {formatCurrency(c.total_invoiced || 0, 'USD')}
                    </td>

                    <td className="py-4 px-4 font-mono font-semibold text-emerald-600">
                      {formatCurrency(c.paid_amount || 0, 'USD')}
                    </td>

                    <td className="py-4 px-4 font-mono font-semibold">
                      {(c.outstanding || 0) > 0 ? (
                        <span className="text-amber-600">{formatCurrency(c.outstanding || 0, 'USD')}</span>
                      ) : (
                        <span className="text-slate-400">{formatCurrency(0, 'USD')}</span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleSelectCustomer(c.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        <span>History</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  {customerDetails?.name || 'Customer Account'}
                </h3>
                <p className="text-xs text-slate-500">{customerDetails?.email}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomerId(null);
                  setCustomerDetails(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingDetails ? (
              <div className="py-12 text-center text-slate-400">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs">Fetching customer invoices...</p>
              </div>
            ) : customerDetails ? (
              <div className="space-y-5">
                {/* Metrics Pill row */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Total Invoiced
                    </span>
                    <span className="font-bold text-slate-900 font-mono">
                      {formatCurrency(customerDetails.total_invoiced || 0, 'USD')}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 block mb-0.5">
                      Verified Paid
                    </span>
                    <span className="font-bold text-emerald-700 font-mono">
                      {formatCurrency(customerDetails.paid_amount || 0, 'USD')}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 block mb-0.5">
                      Outstanding
                    </span>
                    <span className="font-bold text-amber-700 font-mono">
                      {formatCurrency(customerDetails.outstanding || 0, 'USD')}
                    </span>
                  </div>
                </div>

                {/* Invoices List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Invoice History ({customerDetails.invoices.length})
                    </h4>
                  </div>

                  {customerDetails.invoices.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      No invoices recorded for this customer yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {customerDetails.invoices.map((inv) => (
                        <div
                          key={inv.id}
                          onClick={() => {
                            setSelectedCustomerId(null);
                            onNavigateInvoice(inv.id);
                          }}
                          className="p-3 hover:bg-slate-50 flex items-center justify-between cursor-pointer text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-slate-800">
                                {inv.invoice_number}
                              </span>
                              <StatusBadge status={inv.status} size="sm" />
                            </div>
                            <span className="text-slate-400">Due {inv.due_date}</span>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <span className="font-bold text-slate-900 font-mono">
                              {formatCurrency(inv.total_amount, inv.currency)}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Create Invoice Action for this customer */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const name = customerDetails.name;
                        const email = customerDetails.email;
                        setSelectedCustomerId(null);
                        onNavigateCreateForCustomer(name, email);
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Invoice for {customerDetails.name}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleCustomerAdded}
      />
    </div>
  );
};
