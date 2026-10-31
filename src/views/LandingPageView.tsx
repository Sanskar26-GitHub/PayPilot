import React, { useState } from 'react';
import {
  Sparkles,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Zap,
  Globe2,
  Clock,
  Lock,
  Database,
  Cpu,
  RefreshCw,
  Award,
} from 'lucide-react';
import type { Invoice, DashboardMetrics } from '../types.ts';
import { SUPPORTED_CURRENCIES } from '../utils/currency.ts';

interface LandingPageViewProps {
  metrics: DashboardMetrics | null;
  recentInvoices: Invoice[];
  onLaunchApp: (tab?: any, invoiceId?: string) => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onLaunchApp,
}) => {
  const [activeStep, setActiveStep] = useState(0);

  const heroImageSrc = '/src/assets/images/paypilot_showcase_hero_1793431722084.jpg';

  const workflowSteps = [
    {
      num: '01',
      title: 'Prompt',
      label: 'Natural Language Instruction',
      description:
        'Describe services, quantities, rates, customer email, currency, and due date in plain conversational English.',
      code: '“Create an invoice for Rahul Sharma (rahul.sharma@example.com) for 450 Euro for React dashboard development, due in 7 days.”',
    },
    {
      num: '02',
      title: 'Review',
      label: 'Deterministic Validation',
      description:
        'Gemini 3.8 Flash parses the request into a typed invoice draft. The engine validates dates, items, and preserves your exact currency.',
      code: 'Validated: EUR 450.00 · Due: Net 7 · 1 Item · Sequence Assigned',
    },
    {
      num: '03',
      title: 'Pay',
      label: 'PayPal Sandbox Checkout',
      description:
        'PayPilot calls the PayPal REST API to create a sandbox order and generates a shareable buyer checkout link.',
      code: 'POST /v2/checkout/orders → Approval URL & Order ID generated',
    },
    {
      num: '04',
      title: 'Reconcile',
      label: 'Cryptographic Verification',
      description:
        'Upon customer checkout, PayPilot captures and cryptographically verifies the PayPal transaction ID, updating invoice status to Paid.',
      code: 'PayPal Capture Verified · Paid in Full · Audit Log Sealed',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. TOP BAR: [Brand] — [Nav Links] — [Primary Action] */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-8">
        {/* Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <CreditCard className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
            PayPilot
          </span>
        </div>

        {/* Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <a
            href="#features"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Features
          </a>
          <a
            href="#currencies"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Supported Currencies
          </a>
          <a
            href="#workflow"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Workflow
          </a>
          <a
            href="#tech-stack"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Tech Stack
          </a>
        </nav>

        {/* Primary Action CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onLaunchApp('dashboard')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg shadow-md shadow-blue-600/30 transition-all whitespace-nowrap"
          >
            <span>Launch PayPilot</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION: Dark Navy Theme with Electric Blue Accents */}
      <section className="relative overflow-hidden pt-12 pb-20 px-4 sm:px-8 max-w-7xl mx-auto">
        {/* Subtle background glow */}
        <div
          aria-hidden="true"
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none"
        />

        <div className="text-center max-w-4xl mx-auto space-y-6 relative z-10">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Google Gemini 3.8 Flash &bull; PayPal REST Sandbox &bull; Supabase PostgreSQL</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12] text-balance">
            Autonomous Invoicing &amp; Verified Payments for Modern Teams
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed text-balance">
            Turn natural language instructions into validated multi-currency invoices, generate
            PayPal checkout orders, and verify real capture settlements with cryptographic audit
            trails.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
            <button
              onClick={() => onLaunchApp('dashboard')}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all"
            >
              <span>Explore PayPilot App</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onLaunchApp('create-invoice')}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-all"
            >
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Create AI Invoice</span>
            </button>
          </div>

          {/* Live System Trust Strip (No counts or internal ranges) */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>PayPal Verified</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              <span>PostgreSQL Atomic Sequences</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-indigo-400" />
              <span>7 Supported Global Currencies</span>
            </div>
          </div>
        </div>

        {/* Hero Visual Frame / Product Preview */}
        <div className="mt-14 relative max-w-5xl mx-auto">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2 sm:p-3 shadow-2xl shadow-blue-950/40">
            <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-[16/9]">
              <img
                src={heroImageSrc}
                alt="PayPilot Financial Dashboard Interface with Live Analytics and PayPal Checkout"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />

              {/* Floating Architectural Capabilities Overlay (Strictly no database/verification counts) */}
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 p-4 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800/90 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                    AI Extraction
                  </span>
                  <span className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 mt-0.5">
                    <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                    Gemini 3.8 Flash
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Payment Gateway
                  </span>
                  <span className="text-sm sm:text-base font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    PayPal Verified
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Currencies
                  </span>
                  <span className="text-sm sm:text-base font-bold text-blue-400 flex items-center gap-1.5 mt-0.5">
                    <Globe2 className="w-4 h-4 text-blue-400 shrink-0" />
                    7 Standardized
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Sequence Engine
                  </span>
                  <span className="text-sm sm:text-base font-bold text-indigo-400 flex items-center gap-1.5 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    Atomic &amp; Gapless
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SUPPORTED CURRENCIES SECTION (Clean Standardized Grid) */}
      <section id="currencies" className="py-20 bg-slate-900 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              Multi-Currency Precision
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Supported Currencies
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              PayPilot natively supports 7 international currencies with symbol preservation,
              Intl.NumberFormat locale precision, and zero unauthorized conversions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SUPPORTED_CURRENCIES.map((cur) => (
              <div
                key={cur.code}
                className="p-5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {cur.name}
                  </div>
                  <div className="text-base font-bold text-white mt-1">
                    {cur.label}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 text-blue-400 font-mono font-bold flex items-center justify-center text-sm shadow-xs">
                  {cur.symbol}
                </div>
              </div>
            ))}
            <div className="p-5 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  Payment Security
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  PayPal REST Native
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 font-mono font-bold flex items-center justify-center text-sm">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. PROBLEM VS SOLUTION */}
      <section className="py-20 bg-slate-950 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              The Architecture Problem
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Why Freelancers &amp; Small Businesses Lose 14% of Revenue to Payment Latency
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* The Old Way */}
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-rose-900/30 space-y-5">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>The Traditional Invoicing Friction</span>
              </div>
              <ul className="space-y-4 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <span className="text-rose-400 font-bold mt-0.5">&times;</span>
                  <span>
                    <strong>Manual entry mistakes:</strong> Calculating line totals, tax, and due
                    dates in spreadsheets leads to customer disputes and billing errors.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-400 font-bold mt-0.5">&times;</span>
                  <span>
                    <strong>Currency coercion:</strong> Systems default foreign clients to USD,
                    causing exchange loss or confusion for EUR, GBP, CHF, CAD, and AUD billings.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-400 font-bold mt-0.5">&times;</span>
                  <span>
                    <strong>Unverified "Marked as Paid":</strong> Without cryptographic settlement
                    check, administrators mark invoices paid on promises rather than verified receipts.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-400 font-bold mt-0.5">&times;</span>
                  <span>
                    <strong>Awkward follow-ups:</strong> Chasing overdue invoices with manual emails
                    is stressful and degrades valuable customer relationships.
                  </span>
                </li>
              </ul>
            </div>

            {/* The PayPilot Solution */}
            <div className="p-8 rounded-2xl bg-blue-950/20 border border-blue-500/30 space-y-5">
              <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                <span>The PayPilot Autonomous Solution</span>
              </div>
              <ul className="space-y-4 text-sm text-slate-200">
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 font-bold mt-0.5">&#10003;</span>
                  <span>
                    <strong>Natural Language Drafts:</strong> Speak or type what you did. Gemini
                    3.8 Flash extracts items, rates, and client contacts into a clean draft.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 font-bold mt-0.5">&#10003;</span>
                  <span>
                    <strong>Strict Multi-Currency Engine:</strong> Explicit EUR, GBP, CAD, AUD,
                    JPY, CHF, and USD requests are detected and preserved without unauthorized conversions.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 font-bold mt-0.5">&#10003;</span>
                  <span>
                    <strong>PayPal REST Verification:</strong> Client pays in sandbox; backend
                    confirms the capture ID and seals an immutable audit record in PostgreSQL.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 font-bold mt-0.5">&#10003;</span>
                  <span>
                    <strong>Grounded AI Reminders:</strong> Generate polite, firm, or urgent payment
                    reminders with real invoice totals and payment URLs in one click.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 6 CORE CAPABILITIES BENTO GRID */}
      <section id="features" className="py-24 bg-white text-slate-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-blue-600">
              Core Platform Capabilities
            </h2>
            <h3 className="text-3xl font-extrabold tracking-tight text-slate-950">
              Six Pillars Built for Enterprise Reliability
            </h3>
            <p className="text-sm text-slate-600">
              Every feature is implemented with real API calls, strict PostgreSQL transactions, and
              zero mock compromises.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">
                  Natural-Language Extraction
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Powered by Google's Gemini 3.8 Flash SDK. Extracts complex multi-line scopes,
                  hourly rates, recipient emails, and payment dates from natural conversational
                  prompts.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/60 text-xs text-blue-600 font-medium">
                @google/genai &bull; Structured JSON Schema
              </div>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">
                  PayPal REST v2 Checkout &amp; Verification
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Generates authentic PayPal Sandbox checkout orders with itemized breakdowns.
                  Verifies order captures and records transaction IDs with idempotency protection.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/60 text-xs text-sky-600 font-medium">
                Live Sandbox &bull; Verified Captures
              </div>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Database className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">
                  Strict Sequential Numbering
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  PostgreSQL atomic sequence (<code className="text-indigo-700 font-mono">invoice_number_seq</code>)
                  guarantees gapless, sequential invoice identifiers with zero race conditions across concurrent operations.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/60 text-xs text-indigo-600 font-medium">
                Supabase &bull; Two-Phase Transaction Safety
              </div>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">
                  Automatic State Machine
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Strict lifecycle transitions: Draft &rarr; Sent &rarr; Paid or Overdue. Real-time
                  date calculations dynamically flag overdue balances without requiring manual cron
                  triggers.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/60 text-xs text-amber-700 font-medium">
                Deterministic Transitions &bull; Audit Trail
              </div>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Globe2 className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">
                  Global Multi-Currency Precision
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Accurate extraction and display for USD ($), EUR (€), GBP (£), CAD (CA$), AUD (A$), JPY (¥), and CHF (Swiss Franc).
                  Eliminates hardcoded dollar signs with Intl.NumberFormat.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/60 text-xs text-emerald-700 font-medium">
                Intl.NumberFormat &bull; 7 Currencies
              </div>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">
                  Paid Invoice Audit Protection
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Paid invoices are permanently sealed. Delete actions are completely hidden for
                  completed payments, ensuring compliant financial reporting and fraud prevention.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/60 text-xs text-purple-700 font-medium">
                Immutable Records &bull; Compliance Ready
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. 4-STEP WORKFLOW WALKTHROUGH */}
      <section id="workflow" className="py-24 bg-slate-950 text-slate-100 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              How PayPilot Works
            </h2>
            <h3 className="text-3xl font-extrabold tracking-tight text-white">
              From Natural Language to Verified Cash
            </h3>
            <p className="text-sm text-slate-400">
              An end-to-end workflow designed to eliminate manual data entry entirely.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {workflowSteps.map((step, idx) => (
              <div
                key={step.num}
                onClick={() => setActiveStep(idx)}
                className={`p-6 rounded-2xl border transition-all cursor-pointer ${
                  activeStep === idx
                    ? 'bg-slate-900 border-blue-500 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold font-mono text-blue-400">{step.num}</span>
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    {step.title}
                  </span>
                </div>
                <h4 className="font-bold text-white text-base mb-2">{step.label}</h4>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">{step.description}</p>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-blue-300 truncate">
                  {step.code}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. REAL TECH STACK */}
      <section id="tech-stack" className="py-20 bg-slate-900 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              Engineering Architecture
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Production-Grade Full-Stack Stack
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <Cpu className="w-6 h-6 text-blue-400 mx-auto" />
              <div className="font-bold text-sm text-white">Gemini 3.8 Flash</div>
              <div className="text-[11px] text-slate-400">@google/genai SDK</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <CreditCard className="w-6 h-6 text-sky-400 mx-auto" />
              <div className="font-bold text-sm text-white">PayPal REST v2</div>
              <div className="text-[11px] text-slate-400">OAuth &amp; Capture APIs</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <Database className="w-6 h-6 text-emerald-400 mx-auto" />
              <div className="font-bold text-sm text-white">Supabase Postgres</div>
              <div className="text-[11px] text-slate-400">Sequences &amp; Schema</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <Zap className="w-6 h-6 text-yellow-400 mx-auto" />
              <div className="font-bold text-sm text-white">React 19 + Vite</div>
              <div className="text-[11px] text-slate-400">TypeScript SPA</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <RefreshCw className="w-6 h-6 text-indigo-400 mx-auto" />
              <div className="font-bold text-sm text-white">Express.js</div>
              <div className="text-[11px] text-slate-400">Full-Stack Backend</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <ShieldCheck className="w-6 h-6 text-purple-400 mx-auto" />
              <div className="font-bold text-sm text-white">Tailwind CSS</div>
              <div className="text-[11px] text-slate-400">Modern Layouts</div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. CALL TO ACTION & FOOTER */}
      <section className="py-20 bg-slate-950 border-t border-slate-800 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <Award className="w-12 h-12 text-blue-500 mx-auto" />
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Ready to experience PayPilot?
          </h2>
          <p className="text-slate-300 text-sm max-w-xl mx-auto">
            Experience the full live application: extract invoices from AI prompts in 7 global
            currencies, initiate PayPal Sandbox orders, and verify payment settlements.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onLaunchApp('create-invoice')}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-xl shadow-blue-600/30 transition-all"
            >
              <span>Test AI Invoice Generator</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer (No internal database or test counts) */}
      <footer className="py-8 bg-slate-950 border-t border-slate-900 text-center text-xs text-slate-500 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold text-slate-300">
            <CreditCard className="w-4 h-4 text-blue-500" />
            <span>PayPilot &copy; 2026</span>
          </div>
          <p>Autonomous Invoicing &amp; Payment Verification Platform</p>
          <div className="flex items-center gap-4 text-slate-400">
            <button onClick={() => onLaunchApp('dashboard')} className="hover:text-white">
              App Dashboard
            </button>
            <button onClick={() => onLaunchApp('invoices')} className="hover:text-white">
              All Invoices
            </button>
            <button onClick={() => onLaunchApp('settings')} className="hover:text-white">
              Sandbox Status
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
