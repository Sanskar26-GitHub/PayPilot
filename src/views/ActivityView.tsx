import React, { useState, useEffect } from 'react';
import type { ActivityLog } from '../types.ts';
import { fetchActivityLogs } from '../api.ts';
import {
  Clock,
  CheckCircle2,
  CreditCard,
  Sparkles,
  FileText,
  AlertTriangle,
  RefreshCw,
  Search,
} from 'lucide-react';

interface ActivityViewProps {
  onNavigateInvoice: (invoiceId: string) => void;
}

export const ActivityView: React.FC<ActivityViewProps> = ({ onNavigateInvoice }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await fetchActivityLogs(100);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('PAYMENT')) {
      return (
        <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </span>
      );
    }
    if (eventType.includes('PAYPAL')) {
      return (
        <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
          <CreditCard className="w-4 h-4" />
        </span>
      );
    }
    if (eventType.includes('AI')) {
      return (
        <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </span>
      );
    }
    if (eventType.includes('ERROR') || eventType.includes('FAIL')) {
      return (
        <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </span>
      );
    }
    return (
      <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4" />
      </span>
    );
  };

  const filteredLogs = logs.filter((l) => {
    if (filterType !== 'all') {
      if (filterType === 'payment' && !l.event_type.includes('PAYMENT')) return false;
      if (filterType === 'paypal' && !l.event_type.includes('PAYPAL')) return false;
      if (filterType === 'invoice' && !l.event_type.includes('INVOICE') && !l.event_type.includes('DRAFT')) return false;
    }
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return (
        l.description.toLowerCase().includes(t) ||
        l.event_type.toLowerCase().includes(t) ||
        (l.invoice_number && l.invoice_number.toLowerCase().includes(t))
      );
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Activity &amp; Audit Log
          </h2>
          <p className="text-sm text-slate-500">
            Immutable chronological record of invoice lifecycles, PayPal actions, and settlements.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search activity events..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1 self-start sm:self-auto text-xs font-medium">
          {['all', 'payment', 'paypal', 'invoice'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                filterType === f
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f === 'all' ? 'All Events' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Log Feed */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading activity logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-700">No activity matching filter</h3>
            <p className="text-xs text-slate-400 mt-1">Actions performed will appear here automatically.</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors flex items-start gap-4"
            >
              {getEventIcon(log.event_type)}

              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <span className="font-semibold text-sm text-slate-900">
                    {log.description}
                  </span>
                  <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]">
                    {log.event_type}
                  </span>

                  {log.invoice_id && (
                    <button
                      onClick={() => onNavigateInvoice(log.invoice_id!)}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      View Invoice Details &rarr;
                    </button>
                  )}
                </div>

                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <pre className="mt-2 p-2 rounded-lg bg-slate-50 text-[11px] font-mono text-slate-600 border border-slate-100 overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
