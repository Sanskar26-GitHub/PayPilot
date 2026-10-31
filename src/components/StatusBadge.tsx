import React from 'react';
import type { InvoiceStatus } from '../types.ts';
import { CheckCircle2, Clock, AlertTriangle, FileText, Send, XCircle } from 'lucide-react';

interface Props {
  status: InvoiceStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<Props> = ({ status, size = 'md' }) => {
  const norm = status.toLowerCase();

  const getStyle = () => {
    switch (norm) {
      case 'paid':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          label: 'Paid',
        };
      case 'overdue':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          dot: 'bg-rose-500',
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          label: 'Overdue',
        };
      case 'sent':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500',
          icon: <Send className="w-3.5 h-3.5" />,
          label: 'Sent',
        };
      case 'pending':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          icon: <Clock className="w-3.5 h-3.5" />,
          label: 'Pending',
        };
      case 'draft':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          icon: <FileText className="w-3.5 h-3.5" />,
          label: 'Draft',
        };
      case 'created':
        return {
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          dot: 'bg-indigo-500',
          icon: <FileText className="w-3.5 h-3.5" />,
          label: 'Created',
        };
      case 'cancelled':
      case 'failed':
        return {
          bg: 'bg-zinc-100 text-zinc-600 border-zinc-200',
          dot: 'bg-zinc-400',
          icon: <XCircle className="w-3.5 h-3.5" />,
          label: norm.charAt(0).toUpperCase() + norm.slice(1),
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          icon: <FileText className="w-3.5 h-3.5" />,
          label: status,
        };
    }
  };

  const style = getStyle();
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-md border ${style.bg} ${padding}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      <span>{style.label}</span>
    </span>
  );
};
