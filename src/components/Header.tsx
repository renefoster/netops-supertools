import React, { useState } from 'react';
import { useNetOps } from '../context/NetOpsContext';
import {
  Activity,
  ShieldCheck,
  Radio,
  ArrowDownUp,
  User,
  LogOut,
  Settings,
} from 'lucide-react';
import { UserProfileModal } from './modals/UserProfileModal';
import { TooltipProvider, MetricTooltip } from './ui/tooltip';

interface HeaderProps {
  currentUser?: { username: string; full_name: string; role: string } | null;
  companyName?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentUser, companyName, onLogout }) => {
  const { summary, sseConnected } = useNetOps();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [displayUser, setDisplayUser] = useState(currentUser);
  const [displayCompanyName, setDisplayCompanyName] = useState(companyName || 'NetOps Enterprise');

  const healthScore = summary?.fleet_health_score ?? 100;
  const rxMbps = summary?.total_rx_mbps || 0;
  const txMbps = summary?.total_tx_mbps || 0;
  const avgLatency = summary?.avg_network_latency || 0;

  const handleProfileUpdated = (
    updatedUser: { username: string; full_name: string; role: string },
    newCompanyName: string
  ) => {
    setDisplayUser(updatedUser);
    if (newCompanyName) setDisplayCompanyName(newCompanyName);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <header className="bg-[#0f1522] border-b border-[#1e2d45] px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-4">
          {/* Brand & App Title Only */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-sm">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h1 className="font-bold tracking-tight text-white text-base sm:text-lg whitespace-nowrap">
                NetOps SuperTools
              </h1>
            </div>

            {/* Real-time Connection Status */}
            <div
              className="flex items-center gap-1.5 bg-[#151d2e] px-2.5 py-1 rounded-full border border-[#1e2d45] text-xs shrink-0"
              title={sseConnected ? 'Real-time telemetry stream connected' : 'Connecting to background daemon...'}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  sseConnected ? 'bg-emerald-400 status-pulse-green' : 'bg-red-400 status-pulse-red'
                }`}
              />
              <span className="text-[10px] sm:text-[11px] font-mono font-semibold text-emerald-400">
                {sseConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>

          {/* Right Metrics & User Controls (Icons Only with Tooltips) */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* 1. Fleet Health (Icon Only with Tooltip) */}
            <MetricTooltip
              title="Fleet Health"
              value={`${healthScore}%`}
              subtitle={
                healthScore > 85
                  ? 'All core & distribution nodes operational'
                  : healthScore > 60
                  ? 'Degraded performance detected'
                  : 'Critical hardware outages require attention'
              }
            >
              <button
                type="button"
                className="w-9 h-9 rounded-lg bg-[#151d2e] hover:bg-[#1a2438] border border-[#1e2d45] hover:border-[#2a3a52] flex items-center justify-center transition relative group"
                aria-label="Fleet Health"
              >
                <ShieldCheck
                  className={`w-4 h-4 ${
                    healthScore > 85
                      ? 'text-emerald-400'
                      : healthScore > 60
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}
                />
                <span
                  className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                    healthScore > 85
                      ? 'bg-emerald-400'
                      : healthScore > 60
                      ? 'bg-amber-400'
                      : 'bg-red-400'
                  }`}
                />
              </button>
            </MetricTooltip>

            {/* 2. Throughput (Icon Only with Tooltip) */}
            <MetricTooltip
              title="Network Throughput"
              value={`↓ ${rxMbps} Mb/s  •  ↑ ${txMbps} Mb/s`}
              subtitle="Aggregated interface bandwidth"
            >
              <button
                type="button"
                className="w-9 h-9 rounded-lg bg-[#151d2e] hover:bg-[#1a2438] border border-[#1e2d45] hover:border-[#2a3a52] flex items-center justify-center transition text-blue-400 group"
                aria-label="Throughput"
              >
                <ArrowDownUp className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
              </button>
            </MetricTooltip>

            {/* 3. Average Latency (Icon Only with Tooltip) */}
            <MetricTooltip
              title="Average Latency"
              value={`${avgLatency} ms`}
              subtitle="ICMP Echo & SNMP round-trip response"
            >
              <button
                type="button"
                className="w-9 h-9 rounded-lg bg-[#151d2e] hover:bg-[#1a2438] border border-[#1e2d45] hover:border-[#2a3a52] flex items-center justify-center transition text-emerald-400 group"
                aria-label="Average Latency"
              >
                <Radio className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              </button>
            </MetricTooltip>

            {/* 4. User Menu (Icon Only with Tooltip & Dropdown) */}
            {displayUser && (
              <div className="relative">
                <MetricTooltip
                  title={displayUser.full_name || displayUser.username}
                  value={`@${displayUser.username}`}
                  subtitle={displayUser.role || 'Super Admin'}
                >
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="w-9 h-9 rounded-lg bg-[#151d2e] hover:bg-[#1f2b42] border border-[#1e2d45] hover:border-emerald-500/40 flex items-center justify-center transition text-emerald-400"
                    aria-label="User profile and settings"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  </button>
                </MetricTooltip>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#151d2e] border border-[#2a3a52] rounded-xl shadow-2xl p-2 z-50 animate-fadeIn">
                    <div className="p-2 border-b border-[#1e2d45] mb-1">
                      <div className="text-white font-bold text-xs">{displayUser.full_name}</div>
                      <div className="text-[10px] text-[#8892a4] font-mono">@{displayUser.username}</div>
                      <div className="text-[10px] text-emerald-400 font-mono mt-0.5">{displayUser.role}</div>
                    </div>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setProfileModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[#e2e8f0] hover:bg-[#1f2b42] rounded-lg text-xs font-medium transition"
                    >
                      <Settings className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Profile & Security</span>
                    </button>

                    {onLogout && (
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-xs font-mono transition mt-1 border-t border-[#1e2d45]"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* User Profile Modal */}
        <UserProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          currentUser={displayUser || currentUser || null}
          companyName={displayCompanyName}
          onProfileUpdated={handleProfileUpdated}
        />
      </header>
    </TooltipProvider>
  );
};
