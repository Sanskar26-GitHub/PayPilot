import React from 'react';
import type { DashboardMetrics, Invoice, ActivityLog } from '../types.ts';
import { getEffectiveInvoiceStatus } from '../types.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { formatCurrency } from '../utils/currency.ts';
import {
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Sparkles,
  Plus,
  CreditCard,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
  recentInvoices: Invoice[];
  recentActivity: ActivityLog[];
  onNavigate: (tab: any, invoiceId?: string) => void;
  isLoading: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  recentInvoices,
  recentActivity,
  onNavigate,
  isLoading,
}) => {
  if (isLoading && !metrics) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-200" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-xl border border-slate-200" />
      </div>
    );
  }

  const m = metrics || {
    totalInvoiced: 0,
    amountReceived: 0,
    outstandingBalance: 0,
    overdueCount: 0,
    totalInvoicesCount: 0,
    paidInvoicesCount: 0,
    currency: 'USD',
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Callout */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden border border-slate-800">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            AI-Assisted Billing &amp; Verified PayPal Settlement
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
            Automate invoicing with Gemini. Settle via PayPal Sandbox.
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">
            Draft structured invoices from natural language in seconds, send PayPal Sandbox checkout links, and verify captures with cryptographic assurance.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('create-invoice')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Invoice</span>
            </button>
            <button
              onClick={() => onNavigate('ai-assistant')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 text-slate-100 border border-white/15 backdrop-blur-xs transition-colors"
            >
              <Sparkles className="w-4 h-4 text-blue-300" />
              <span>Ask AI Assistant</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Invoiced</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            ${m.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500">
            <span className="text-slate-600 font-medium mr-1.5">{m.totalInvoicesCount}</span>
            total invoices (excluding drafts)
          </div>
        </div>

        {/* Amount Received */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Payments Received</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 tracking-tight">
            ${m.amountReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500">
            <span className="text-emerald-700 font-medium mr-1.5">{m.paidInvoicesCount} paid</span>
            via verified PayPal Sandbox
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Outstanding Balance</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 tracking-tight">
            ${m.outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500">
            Awaiting client remittance
          </div>
        </div>

        {/* Overdue Count */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Overdue Invoices</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-bold tracking-tight ${m.overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {m.overdueCount}
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500">
            {m.overdueCount > 0 ? (
              <span className="text-rose-600 font-medium">Requires immediate follow-up</span>
            ) : (
              <span className="text-emerald-600 font-medium">All accounts are current</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Invoices + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoices (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Recent Invoices</h3>
              <p className="text-xs text-slate-500">Latest active and draft invoice records</p>
            </div>
            <button
              onClick={() => onNavigate('invoices')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {recentInvoices.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-sm">No invoices created yet.</p>
                <button
                  onClick={() => onNavigate('create-invoice')}
                  className="mt-3 text-xs text-blue-600 font-semibold hover:underline"
                >
                  Create your first invoice
                </button>
              </div>
            ) : (
              recentInvoices.slice(0, 6).map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => onNavigate('invoice-details', inv.id)}
                  className="p-4 hover:bg-slate-50/80 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-slate-900">
                        {inv.invoice_number}
                      </span>
                      <StatusBadge status={getEffectiveInvoiceStatus(inv)} size="sm" />
                    </div>
                    <p className="text-xs text-slate-600 truncate">
                      {inv.customer_name || 'No customer specified'} &bull; Due {inv.due_date}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <div className="font-bold text-sm text-slate-900">
                        {formatCurrency(inv.total_amount, inv.currency)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {inv.paypal_order_id ? 'PayPal Linked' : 'Direct'}
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Payment & Activity Log (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Recent Activity</h3>
              <p className="text-xs text-slate-500">Audit trail of payments &amp; invoices</p>
            </div>
            <button
              onClick={() => onNavigate('activity')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              <span>History</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[380px]">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No recent activity recorded.</p>
            ) : (
              recentActivity.slice(0, 6).map((act) => (
                <div key={act.id} className="flex gap-3 text-xs">
                  <div className="mt-0.5">
                    {act.event_type.includes('PAYMENT') ? (
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    ) : act.event_type.includes('PAYPAL') ? (
                      <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center">
                        <CreditCard className="w-3.5 h-3.5" />
                      </span>
                    ) : act.event_type.includes('AI') ? (
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-800 font-medium leading-snug">{act.description}</p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull;{' '}
                      {new Date(act.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
