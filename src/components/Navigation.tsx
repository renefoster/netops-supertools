import React from 'react';
import {
  LayoutDashboard,
  GitFork,
  Server,
  Radar,
  Wrench,
  FileCode,
  FileBarChart,
} from 'lucide-react';
import { useNetOps } from '../context/NetOpsContext';

export type ActiveTab =
  | 'overview'
  | 'topology'
  | 'inventory'
  | 'discovery'
  | 'diagnostics'
  | 'backups'
  | 'reports';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const { rcaResults } = useNetOps();

  const tabs: Array<{
    id: ActiveTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      shortLabel: 'Overview',
      icon: LayoutDashboard,
      badge: rcaResults.length > 0 ? `${rcaResults.length} RCA` : undefined,
    },
    {
      id: 'topology',
      label: 'Topology',
      shortLabel: 'Topology',
      icon: GitFork,
    },
    {
      id: 'inventory',
      label: 'Inventory',
      shortLabel: 'Inventory',
      icon: Server,
    },
    {
      id: 'discovery',
      label: 'Discovery',
      shortLabel: 'Discovery',
      icon: Radar,
    },
    {
      id: 'diagnostics',
      label: 'Diagnostics',
      shortLabel: 'Diagnostics',
      icon: Wrench,
    },
    {
      id: 'backups',
      label: 'Backup',
      shortLabel: 'Backup',
      icon: FileCode,
    },
    {
      id: 'reports',
      label: 'SLA & Reports',
      shortLabel: 'SLA & Reports',
      icon: FileBarChart,
    },
  ];

  return (
    <nav className="bg-[#0f1522] border-b border-[#1e2d45] px-2 sm:px-4 lg:px-6 sticky top-[57px] sm:top-[61px] z-30 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-2 scrollbar-none touch-pan-x">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 relative shrink-0 ${
                isActive
                  ? 'bg-[#1a2438] text-white shadow-sm border border-[#2a3a52]'
                  : 'text-[#8892a4] hover:text-white hover:bg-[#151d2e]'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-[#8892a4]'
                }`}
              />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="inline sm:hidden">{tab.shortLabel}</span>

              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-red-500/20 border border-red-500/40 text-red-400 shrink-0">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
