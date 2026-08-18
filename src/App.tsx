/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { NetOpsProvider } from './context/NetOpsContext';
import { Header } from './components/Header';
import { Navigation, ActiveTab } from './components/Navigation';
import { OverviewView } from './components/views/OverviewView';
import { TopologyView } from './components/views/TopologyView';
import { InventoryView } from './components/views/InventoryView';
import { DiscoveryView } from './components/views/DiscoveryView';
import { DiagnosticsView } from './components/views/DiagnosticsView';
import { BackupsView } from './components/views/BackupsView';
import { ReportsView } from './components/views/ReportsView';
import { DeviceDetailModal } from './components/modals/DeviceDetailModal';
import { SetupWizard } from './components/setup/SetupWizard';
import { LoginPage } from './components/auth/LoginPage';
import { Device } from './types/netops';
import { Activity } from 'lucide-react';

const VALID_TABS: ActiveTab[] = [
  'overview',
  'topology',
  'inventory',
  'discovery',
  'diagnostics',
  'backups',
  'reports',
];

function getInitialTabFromUrl(): ActiveTab {
  if (typeof window === 'undefined') return 'overview';

  // 1. Check URL Hash (e.g. /#topology)
  const hash = window.location.hash.replace('#', '').toLowerCase().trim();
  if (VALID_TABS.includes(hash as ActiveTab)) {
    return hash as ActiveTab;
  }

  // 2. Check Search Param (e.g. /?tab=topology)
  const searchParams = new URLSearchParams(window.location.search);
  const tabParam = searchParams.get('tab')?.toLowerCase().trim();
  if (tabParam && VALID_TABS.includes(tabParam as ActiveTab)) {
    return tabParam as ActiveTab;
  }

  // 3. Fallback to localStorage persistence
  try {
    const saved = (localStorage.getItem('netops_supertools_active_tab') || localStorage.getItem('_netops_active_tab')) as ActiveTab;
    if (saved && VALID_TABS.includes(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage restrictions
  }

  return 'overview';
}

function NetOpsApp({
  currentUser,
  companyName,
  onLogout,
}: {
  currentUser?: { username: string; full_name: string; role: string } | null;
  companyName?: string;
  onLogout?: () => void;
}) {
  const [activeTab, setActiveTabState] = useState<ActiveTab>(getInitialTabFromUrl);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>(undefined);

  // Synchronize Tab switch with URL Hash, Search Params, and LocalStorage
  const handleTabChange = useCallback((newTab: ActiveTab) => {
    setActiveTabState(newTab);

    // Update URL hash smoothly without triggering full reload
    try {
      if (window.location.hash !== `#${newTab}`) {
        window.history.pushState(null, '', `#${newTab}`);
      }
      localStorage.setItem('netops_supertools_active_tab', newTab);
    } catch {
      // Ignore
    }
  }, []);

  // Listen to browser Back/Forward navigation & Hash changes
  useEffect(() => {
    const handlePopState = () => {
      const currentTab = getInitialTabFromUrl();
      setActiveTabState(currentTab);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);

    // Sync initial load URL hash if not present
    if (!window.location.hash) {
      window.history.replaceState(null, '', `#${activeTab}`);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, [activeTab]);

  const handleOpenAiWithSymptom = (symptom: string) => {
    setAiInitialPrompt(symptom);
    handleTabChange('diagnostics');
  };

  const handleOpenDiagnosticsWithIp = (ip: string) => {
    handleTabChange('diagnostics');
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e2e8f0] flex flex-col selection:bg-emerald-500/30 selection:text-white">
      {/* Top OPS Bar */}
      <Header currentUser={currentUser} companyName={companyName} onLogout={onLogout} />

      {/* Navigation Sub-bar with responsive horizontal scroll and URL persistence */}
      <Navigation activeTab={activeTab} setActiveTab={handleTabChange} />

      {/* Main Content Area - Responsive Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6 pb-16">
        {activeTab === 'overview' && (
          <OverviewView
            onSelectDevice={(d) => setSelectedDevice(d)}
            onOpenAiDiagnostics={handleOpenAiWithSymptom}
          />
        )}

        {activeTab === 'topology' && (
          <TopologyView onSelectDevice={(d) => setSelectedDevice(d)} />
        )}

        {activeTab === 'inventory' && (
          <InventoryView onSelectDevice={(d) => setSelectedDevice(d)} />
        )}

        {activeTab === 'discovery' && <DiscoveryView />}

        {activeTab === 'diagnostics' && (
          <DiagnosticsView initialAiPrompt={aiInitialPrompt} />
        )}

        {activeTab === 'backups' && <BackupsView />}

        {activeTab === 'reports' && <ReportsView />}
      </main>

      {/* Modal Inspector */}
      {selectedDevice && (
        <DeviceDetailModal
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onOpenDiagnostics={handleOpenDiagnosticsWithIp}
        />
      )}

      {/* Global Status Footer */}
      <footer className="bg-[#0f1522] border-t border-[#1e2d45] py-2 px-4 sm:px-6 text-center text-xs text-[#8892a4] flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 status-pulse-green shrink-0" />
          <span className="truncate">Net Super Tool • Self-Hosted Daemon Operational</span>
        </div>
        <div className="font-mono text-[11px] text-[#8892a4]">
          Subnet: 192.168.1.0/24 • Multi-Vendor SNMP / RouterOS / SSH
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [isSetupCompleted, setIsSetupCompleted] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{ username: string; full_name: string; role: string } | null>(null);
  const [companyName, setCompanyName] = useState<string>(' Operations');

  const checkStatus = async () => {
    try {
      const token = localStorage.getItem('_netops_auth_token') || '';
      const res = await fetch(`/api/setup/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((r) => r.json());

      if (res.success && res.data) {
        setIsSetupCompleted(res.data.is_setup_completed);
        setIsAuthenticated(res.data.is_authenticated);
        if (res.data.user) {
          setCurrentUser(res.data.user);
        }
        if (res.data.company_info?.name) {
          setCompanyName(res.data.company_info.name);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleSetupFinished = () => {
    setIsSetupCompleted(true);
    setIsAuthenticated(false);
    checkStatus();
  };

  const handleLoginSuccess = (
    user: { username: string; full_name: string; role: string },
    token: string,
    compName: string
  ) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    if (compName) setCompanyName(compName);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('_netops_auth_token');
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
    } catch {
      // Ignore
    }
    localStorage.removeItem('_netops_auth_token');
    localStorage.removeItem('_netops_user');
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center text-emerald-400 space-y-3 font-mono text-xs">
        <Activity className="w-8 h-8 animate-pulse" />
        <div>CHECKING SYSTEM SETUP STATE...</div>
      </div>
    );
  }

  // If system has not been setup yet, force user directly into SetupWizard (3 Steps)
  if (!isSetupCompleted) {
    return <SetupWizard onSetupCompleted={handleSetupFinished} />;
  }

  // If setup is complete but user is not logged in, show LoginPage
  if (!isAuthenticated) {
    return <LoginPage companyName={companyName} onLoginSuccess={handleLoginSuccess} />;
  }

  // Authenticated full dashboard app
  return (
    <NetOpsProvider>
      <NetOpsApp currentUser={currentUser} companyName={companyName} onLogout={handleLogout} />
    </NetOpsProvider>
  );
}
