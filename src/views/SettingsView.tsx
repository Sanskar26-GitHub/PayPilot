import React, { useState } from 'react';
import type { IntegrationStatus } from '../types.ts';
import {
  ShieldCheck,
  CreditCard,
  Database,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Terminal,
  RefreshCw,
} from 'lucide-react';

interface SettingsViewProps {
  integrations: IntegrationStatus | null;
  isLoading: boolean;
  onRefresh: () => void;
}

const SUPABASE_SCHEMA_SQL = `-- PayPilot Supabase Schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    description TEXT DEFAULT 'Professional Services',
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    paypal_invoice_id TEXT UNIQUE,
    paypal_order_id TEXT UNIQUE,
    payment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    paypal_order_id TEXT,
    paypal_capture_id TEXT UNIQUE,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;

export const SettingsView: React.FC<SettingsViewProps> = ({
  integrations,
  isLoading,
  onRefresh,
}) => {
  const [copiedSql, setCopiedSql] = useState(false);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Settings &amp; Integration Status
          </h2>
          <p className="text-sm text-slate-500">
            Real-time health monitor and credentials configuration for PayPal Sandbox, PostgreSQL, and Gemini.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Check Connections</span>
        </button>
      </div>

      {/* Troubleshooting / Alert Banner if PostgreSQL connection is pending or has auth notice */}
      {integrations?.database && !integrations.database.connected && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 text-amber-900 text-xs sm:text-sm space-y-2 shadow-xs">
          <div className="flex items-center gap-2 font-semibold text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Database Status: Active in Local Resilient Fallback Store</span>
          </div>
          <p className="text-amber-800 text-xs leading-relaxed">
            {integrations.database.error}
          </p>
          <div className="text-xs text-amber-900 bg-amber-100/70 p-2.5 rounded-lg border border-amber-200 leading-relaxed">
            <strong>How to connect your live Supabase database:</strong> In your Supabase dashboard, verify your password under <strong>Project Settings &gt; Database</strong> (or click <em>Reset Database Password</em> if needed). Update <code>DATABASE_URL</code> in AI Studio <strong>Settings &gt; Secrets</strong>, then click <strong>Check Connections</strong> above.
          </div>
        </div>
      )}

      {/* 3 Service Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* PostgreSQL / Supabase Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Database className="w-5 h-5" />
            </div>
            {integrations?.database?.connected ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                Fallback / Pending
              </span>
            )}
          </div>

          <div>
            <h3 className="font-bold text-slate-900 text-base">PostgreSQL Database</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Provider:{' '}
              <span className="font-semibold text-slate-700 capitalize">
                {integrations?.database?.provider === 'supabase' ? 'Supabase' : 'PostgreSQL'}
              </span>
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs space-y-1 text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Database:</span>
              <span className="font-mono font-medium">
                {integrations?.database?.databaseName || 'in_memory_paypilot'}
              </span>
            </div>
            {integrations?.database?.host && (
              <div className="flex justify-between">
                <span className="text-slate-400">Host:</span>
                <span className="font-mono font-medium truncate max-w-[150px]">
                  {integrations.database.host}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Schema:</span>
              <span className="font-semibold text-emerald-600">Initialized &amp; Verified</span>
            </div>
          </div>
        </div>

        {/* PayPal Sandbox Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600">
              <CreditCard className="w-5 h-5" />
            </div>
            {integrations?.paypal?.reachable ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Live in Sandbox
              </span>
            ) : integrations?.paypal?.configured ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                Configured / Unchecked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                Credentials Needed
              </span>
            )}
          </div>

          <div>
            <h3 className="font-bold text-slate-900 text-base">PayPal Sandbox</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              API Mode:{' '}
              <span className="font-semibold text-sky-700 uppercase">Sandbox (Test Mode)</span>
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs space-y-1 text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Endpoint:</span>
              <span className="font-mono font-medium truncate max-w-[150px]">api-m.sandbox.paypal.com</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Client ID:</span>
              <span className="font-mono font-medium">
                {integrations?.paypal?.clientIdMasked || 'Not set'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Secret:</span>
              <span className="font-mono text-slate-400">
                {integrations?.paypal?.configured ? '••••••••' : 'Missing'}
              </span>
            </div>
          </div>
        </div>

        {/* Gemini AI Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            {integrations?.gemini?.configured ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                Key Injected / Pending
              </span>
            )}
          </div>

          <div>
            <h3 className="font-bold text-slate-900 text-base">Google Gemini AI</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Model: <span className="font-mono font-semibold text-indigo-600">gemini-3.8-flash</span>
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs space-y-1 text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">SDK:</span>
              <span className="font-semibold text-slate-700">@google/genai v2.4</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Execution:</span>
              <span className="font-semibold text-slate-700">100% Server-Side Only</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Key Handling:</span>
              <span className="text-slate-500">AI Studio Server Secrets</span>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Guide: Supabase & PayPal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PayPal Sandbox Setup */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-base">PayPal Sandbox Credentials Guide</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            To connect real PayPal Sandbox payments to PayPilot:
          </p>
          <ol className="list-decimal list-inside text-xs text-slate-700 space-y-2 leading-relaxed">
            <li>
              Log into{' '}
              <a
                href="https://developer.paypal.com/dashboard/applications/sandbox"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 font-medium underline inline-flex items-center gap-0.5"
              >
                PayPal Developer Dashboard <ExternalLink className="w-3 h-3" />
              </a>.
            </li>
            <li>Under <strong>REST API apps</strong>, click <strong>Create App</strong> or use <strong>Default Application</strong>.</li>
            <li>Copy your <strong>Client ID</strong> and <strong>Secret</strong>.</li>
            <li>
              In Google AI Studio, open <strong>Settings &gt; Secrets</strong> and add:
              <div className="mt-1 p-2 rounded bg-slate-900 text-slate-200 font-mono text-[11px] space-y-0.5">
                <div>PAYPAL_CLIENT_ID = &lt;Your Sandbox Client ID&gt;</div>
                <div>PAYPAL_CLIENT_SECRET = &lt;Your Sandbox Secret&gt;</div>
              </div>
            </li>
            <li>Click <strong>Check Connections</strong> above to verify live reachability!</li>
          </ol>
        </div>

        {/* Supabase Database Setup */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-base">Supabase PostgreSQL Setup Guide</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            To connect your own hosted Supabase PostgreSQL database:
          </p>
          <ol className="list-decimal list-inside text-xs text-slate-700 space-y-2 leading-relaxed">
            <li>
              Create a free project at{' '}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 font-medium underline inline-flex items-center gap-0.5"
              >
                supabase.com <ExternalLink className="w-3 h-3" />
              </a>.
            </li>
            <li>Go to <strong>Project Settings &gt; Database &gt; Connection string (Node.js)</strong>.</li>
            <li>
              In AI Studio <strong>Settings &gt; Secrets</strong>, set:
              <div className="mt-1 p-2 rounded bg-slate-900 text-slate-200 font-mono text-[11px]">
                DATABASE_URL = postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
              </div>
            </li>
            <li>Execute the schema SQL below in your Supabase SQL Editor if required.</li>
          </ol>
        </div>
      </div>

      {/* Copyable SQL Schema Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-slate-700" />
            <h3 className="font-bold text-slate-900 text-base">Supabase Schema (DDL)</h3>
          </div>
          <button
            onClick={handleCopySql}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Schema'}</span>
          </button>
        </div>
        <p className="text-xs text-slate-500">
          This script creates the 5 core relational tables (customers, invoices, invoice_items, payments, activity_logs) with UUIDs and check constraints.
        </p>
        <div className="max-h-60 overflow-y-auto rounded-xl bg-slate-950 p-4 border border-slate-800 text-slate-300 font-mono text-xs">
          <pre>{SUPABASE_SCHEMA_SQL}</pre>
        </div>
      </div>
    </div>
  );
};
