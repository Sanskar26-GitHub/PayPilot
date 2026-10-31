import { Menu, Plus, RefreshCw, TestTube2, Award } from 'lucide-react';
import type { NavigationTab } from './Sidebar.tsx';

interface HeaderProps {
  currentTab: NavigationTab;
  onOpenMobileMenu: () => void;
  onNavigate: (tab: NavigationTab) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileMenu,
  onNavigate,
  onRefresh,
  isRefreshing = false,
}) => {
  const getTabTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Financial Overview';
      case 'invoices':
        return 'Invoices & Payments';
      case 'create-invoice':
        return 'Create New Invoice';
      case 'invoice-details':
        return 'Invoice Details';
      case 'customers':
        return 'Customers & Accounts';
      case 'ai-assistant':
        return 'AI Financial Assistant';
      case 'activity':
        return 'System Activity Log';
      case 'settings':
        return 'Integration & Service Status';
      default:
        return 'PayPilot';
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 leading-tight">
              {getTabTitle()}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <TestTube2 className="w-3 h-3 text-amber-600" />
              PayPal Sandbox
            </span>
          </div>
          <p className="text-xs text-slate-500 hidden md:block">
            PayPilot — AI-assisted invoicing &amp; verified PayPal payment workflow
          </p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh data"
          className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        <button
          onClick={() => onNavigate('showcase')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          title="View Product Overview"
        >
          <Award className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Overview</span>
        </button>

        {currentTab !== 'create-invoice' && (
          <button
            onClick={() => onNavigate('create-invoice')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>
        )}
      </div>
    </header>
  );
};
