import React, { useState, useEffect } from 'react';
import type { NavigationTab } from './components/Sidebar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { InvoicesView } from './views/InvoicesView.tsx';
import { CreateInvoiceView } from './views/CreateInvoiceView.tsx';
import { InvoiceDetailsView } from './views/InvoiceDetailsView.tsx';
import { CustomersView } from './views/CustomersView.tsx';
import { AiAssistantView } from './views/AiAssistantView.tsx';
import { ActivityView } from './views/ActivityView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { LandingPageView } from './views/LandingPageView.tsx';

import type {
  Invoice,
  DashboardMetrics,
  IntegrationStatus,
  ActivityLog,
} from './types.ts';
import {
  fetchDashboardMetrics,
  fetchInvoices,
  fetchIntegrationStatus,
  fetchActivityLogs,
} from './api.ts';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('showcase');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [prefilledCustomer, setPrefilledCustomer] = useState<{ name: string; email: string } | null>(null);

  // Global state
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const syncUrl = (tab: NavigationTab, invoiceId?: string | null) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', tab);
      if (invoiceId && tab === 'invoice-details') {
        url.searchParams.set('id', invoiceId);
      } else {
        url.searchParams.delete('id');
      }
      window.history.pushState({}, '', url.toString());
    } catch (e) {
      // ignore
    }
  };

  // Check URL query parameters on load (e.g., from direct link, refresh, or PayPal redirect)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') as NavigationTab | null;
      const idParam = params.get('id');

      if (idParam) {
        setSelectedInvoiceId(idParam);
        setCurrentTab('invoice-details');
      } else if (
        viewParam &&
        [
          'showcase',
          'dashboard',
          'invoices',
          'create-invoice',
          'invoice-details',
          'customers',
          'ai-assistant',
          'activity',
          'settings',
        ].includes(viewParam)
      ) {
        setCurrentTab(viewParam);
      } else {
        setCurrentTab('showcase');
      }
    } catch (e) {
      // ignore
    }

    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view') as NavigationTab | null;
        const idParam = params.get('id');

        if (idParam) {
          setSelectedInvoiceId(idParam);
          setCurrentTab('invoice-details');
        } else if (
          viewParam &&
          [
            'showcase',
            'dashboard',
            'invoices',
            'create-invoice',
            'invoice-details',
            'customers',
            'ai-assistant',
            'activity',
            'settings',
          ].includes(viewParam)
        ) {
          setCurrentTab(viewParam);
        } else {
          setCurrentTab('showcase');
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadAllData = async () => {
    setIsRefreshing(true);
    try {
      const [m, invs, logs, integ] = await Promise.all([
        fetchDashboardMetrics().catch(() => null),
        fetchInvoices().catch(() => []),
        fetchActivityLogs(15).catch(() => []),
        fetchIntegrationStatus(false).catch(() => null),
      ]);

      if (m) setMetrics(m);
      if (invs) setInvoices(invs);
      if (logs) setActivity(logs);
      if (integ) setIntegrations(integ);
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleNavigate = (tab: NavigationTab, invoiceId?: string) => {
    if (tab !== 'create-invoice') {
      setEditingInvoice(null);
      setPrefilledCustomer(null);
    }
    setCurrentTab(tab);
    if (invoiceId) {
      setSelectedInvoiceId(invoiceId);
    }
    syncUrl(tab, invoiceId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setPrefilledCustomer(null);
    setCurrentTab('create-invoice');
    syncUrl('create-invoice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateForCustomer = (name: string, email: string) => {
    setEditingInvoice(null);
    setPrefilledCustomer({ name, email });
    setCurrentTab('create-invoice');
    syncUrl('create-invoice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInvoiceCreated = (invoiceId: string) => {
    setEditingInvoice(null);
    setPrefilledCustomer(null);
    loadAllData();
    setSelectedInvoiceId(invoiceId);
    setCurrentTab('invoice-details');
    syncUrl('invoice-details', invoiceId);
  };

  if (currentTab === 'showcase') {
    return (
      <LandingPageView
        metrics={metrics}
        recentInvoices={invoices}
        onLaunchApp={(tab, invoiceId) => {
          handleNavigate(tab || 'dashboard', invoiceId);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white">
      {/* Persistent Sidebar (Desktop) + Responsive Drawer (Mobile) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab !== 'create-invoice') {
            setEditingInvoice(null);
            setPrefilledCustomer(null);
          }
          handleNavigate(tab);
        }}
        integrations={integrations}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <Header
          currentTab={currentTab}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onNavigate={(tab) => {
            if (tab !== 'create-invoice') {
              setEditingInvoice(null);
              setPrefilledCustomer(null);
            }
            handleNavigate(tab);
          }}
          onRefresh={loadAllData}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 pb-16">
          {currentTab === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              recentInvoices={invoices}
              recentActivity={activity}
              onNavigate={handleNavigate}
              isLoading={isLoading}
            />
          )}

          {currentTab === 'invoices' && (
            <InvoicesView
              invoices={invoices}
              isLoading={isLoading}
              onNavigate={handleNavigate}
              onRefresh={loadAllData}
              onEditInvoice={handleEditInvoice}
            />
          )}

          {currentTab === 'create-invoice' && (
            <CreateInvoiceView
              initialInvoice={editingInvoice}
              prefilledCustomer={prefilledCustomer}
              onSuccess={handleInvoiceCreated}
              onCancel={() => {
                setEditingInvoice(null);
                setPrefilledCustomer(null);
                setCurrentTab('invoices');
              }}
            />
          )}

          {currentTab === 'invoice-details' && selectedInvoiceId && (
            <InvoiceDetailsView
              invoiceId={selectedInvoiceId}
              onBack={() => setCurrentTab('invoices')}
              onRefreshParent={loadAllData}
              onEditInvoice={handleEditInvoice}
            />
          )}

          {currentTab === 'customers' && (
            <CustomersView
              onNavigateInvoice={(id) => handleNavigate('invoice-details', id)}
              onNavigateCreateForCustomer={handleCreateForCustomer}
            />
          )}

          {currentTab === 'ai-assistant' && <AiAssistantView />}

          {currentTab === 'activity' && (
            <ActivityView
              onNavigateInvoice={(id) => handleNavigate('invoice-details', id)}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              integrations={integrations}
              isLoading={isLoading}
              onRefresh={loadAllData}
            />
          )}
        </main>
      </div>
    </div>
  );
}
