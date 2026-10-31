import React from 'react';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Users,
  Sparkles,
  Clock,
  Sliders,
  ShieldCheck,
  CreditCard,
  Database,
  X,
  Award,
} from 'lucide-react';
import type { IntegrationStatus } from '../types.ts';

export type NavigationTab =
  | 'showcase'
  | 'dashboard'
  | 'invoices'
  | 'create-invoice'
  | 'invoice-details'
  | 'customers'
  | 'ai-assistant'
  | 'activity'
  | 'settings';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  integrations?: IntegrationStatus | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  integrations,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'showcase', label: 'Showcase Page', icon: Award, badge: 'Showcase' },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'create-invoice', label: 'Create Invoice', icon: PlusCircle },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles, badge: 'Gemini' },
    { id: 'activity', label: 'Activity Log', icon: Clock },
    { id: 'settings', label: 'Settings & Status', icon: Sliders },
  ];

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId as NavigationTab);
    onCloseMobile();
  };

  const content = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold text-lg tracking-wider">
            PP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">PayPilot</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                AI + PayPal
              </span>
            </div>
            <p className="text-xs text-slate-400">Invoice & Payment Engine</p>
          </div>
        </div>
        {isOpenMobile && (
          <button
            onClick={onCloseMobile}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id || (item.id === 'invoices' && currentTab === 'invoice-details');
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : 'bg-indigo-900/60 text-indigo-300 border border-indigo-700/50'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Integration Status Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            Integrations
          </span>
          <button
            onClick={() => handleNavClick('settings')}
            className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Manage
          </button>
        </div>

        <div className="space-y-1.5 text-xs">
          {/* PayPal */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-850/80 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-300">
              <CreditCard className="w-3.5 h-3.5 text-sky-400" />
              <span>PayPal Sandbox</span>
            </div>
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                integrations?.paypal?.configured ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
              title={integrations?.paypal?.configured ? 'PayPal Configured' : 'Credentials Pending'}
            />
          </div>

          {/* Database */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-850/80 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-300">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>PostgreSQL</span>
            </div>
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                integrations?.database?.connected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
              title={
                integrations?.database?.connected
                  ? integrations.database.provider === 'supabase'
                    ? 'Connected (Supabase)'
                    : 'Active (PostgreSQL)'
                  : 'Pending'
              }
            />
          </div>

          {/* Gemini */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-850/80 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Gemini 3.8 Flash</span>
            </div>
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                integrations?.gemini?.configured ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
              title={integrations?.gemini?.configured ? 'Gemini AI Ready' : 'Key Pending'}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 z-30 shadow-xl border-r border-slate-800">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 shadow-2xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
