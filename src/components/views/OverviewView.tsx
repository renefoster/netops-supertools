import React, { useState } from 'react';
import { useNetOps } from '../../context/NetOpsContext';
import { Device, DeviceStatus } from '../../types/netops';
import { LiveRadarWidget } from '../widgets/LiveRadarWidget';
import {
  Server,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  Radio,
  RefreshCw,
  Search,
  Activity,
  Layers,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';

interface OverviewViewProps {
  onSelectDevice: (device: Device) => void;
  onOpenAiDiagnostics?: (symptom: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onSelectDevice, onOpenAiDiagnostics }) => {
  const {
    devices,
    latestPolls,
    alerts,
    rcaResults,
    summary,
    pollDeviceNow,
    acknowledgeAlert,
    clearAlerts,
  } = useNetOps();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pollingId, setPollingId] = useState<string | null>(null);

  // Filter devices
  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.ip.includes(searchQuery) ||
      (d.vendor && d.vendor.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.tags && d.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesZone = selectedZone === 'all' || d.zone === selectedZone;

    const poll = latestPolls[d.id];
    const status = poll?.status || 'unknown';
    const matchesStatus = statusFilter === 'all' || status === statusFilter;

    return matchesSearch && matchesZone && matchesStatus;
  });

  const handlePollNow = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setPollingId(id);
    try {
      await pollDeviceNow(id);
    } finally {
      setTimeout(() => setPollingId(null), 600);
    }
  };

  const getStatusBadge = (status: DeviceStatus) => {
    switch (status) {
      case 'up':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse-green shrink-0" />
            UP
          </span>
        );
      case 'down':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-red-500/10 text-red-400 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 status-pulse-red shrink-0" />
            DOWN
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 status-pulse-amber shrink-0" />
            WARN
          </span>
        );
      case 'affected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-purple-500/10 text-purple-300 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
            RCA
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-[#8892a4] bg-[#151d2e] border border-[#1e2d45]">
            PENDING
          </span>
        );
    }
  };

  const activeAlerts = alerts.filter((a) => !a.resolved_at);

  return (
    <div className="space-y-5">
      {/* Root Cause Analysis (RCA) High-Priority Alert Banner */}
      {rcaResults.length > 0 && (
        <div className="bg-gradient-to-r from-red-950/80 via-red-900/40 to-[#151d2e] border-2 border-red-500/60 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0 status-pulse-red">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase font-mono font-bold tracking-wider text-red-400 bg-red-500/20 px-2 py-0.5 rounded border border-red-500/30">
                    RCA Root Cause Isolated
                  </span>
                  <span className="text-xs text-[#8892a4] hidden sm:inline">
                    Graph BFS Cascade Suppression
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">
                  Single True Outage: {rcaResults[0].root_cause_name} ({rcaResults[0].root_cause_ip})
                </h3>
                <p className="text-xs text-[#e2e8f0]/90 mt-1 max-w-3xl leading-relaxed">
                  {rcaResults[0].impact_summary}
                </p>
                <div className="mt-2 text-xs font-mono text-amber-300 bg-black/40 px-3 py-1.5 rounded-lg border border-amber-500/20 inline-flex items-center gap-2">
                  <span>💡 Fix:</span> {rcaResults[0].recommendation}
                </div>
              </div>
            </div>

            {/* Quick Action for RCA */}
            {onOpenAiDiagnostics && (
              <button
                onClick={() =>
                  onOpenAiDiagnostics(
                    `RCA Failure on ${rcaResults[0].root_cause_name} (${rcaResults[0].root_cause_ip}). Impacting ${rcaResults[0].affected_devices_count} downstream nodes.`
                  )
                }
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white rounded-xl font-medium text-xs shadow-lg transition shrink-0 self-stretch sm:self-auto justify-center"
              >
                <Sparkles className="w-4 h-4" />
                <span>AI Remediation Plan</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Real-time 360° Tactical Radar Widget */}
      <LiveRadarWidget onSelectDevice={onSelectDevice} />

      {/* Fleet KPI Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {/* Total Monitored */}
        <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-[#2a3a52] transition">
          <div className="flex items-center justify-between text-[#8892a4]">
            <span className="text-xs font-medium">Monitored</span>
            <Server className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold font-mono text-white">
              {summary?.total_devices || devices.length}
            </div>
            <div className="text-[10px] sm:text-[11px] text-[#8892a4] truncate">Total Endpoints</div>
          </div>
        </div>

        {/* Online Devices */}
        <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-[#2a3a52] transition">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-medium">Online</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
              {summary?.online_count ?? 0}
            </div>
            <div className="text-[10px] sm:text-[11px] text-[#8892a4] truncate">Healthy & Pingable</div>
          </div>
        </div>

        {/* Degraded / Warnings */}
        <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-[#2a3a52] transition">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-medium">Degraded</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400">
              {summary?.degraded_count ?? 0}
            </div>
            <div className="text-[10px] sm:text-[11px] text-[#8892a4] truncate">Loss/Jitter Warning</div>
          </div>
        </div>

        {/* Down / Outage */}
        <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-[#2a3a52] transition">
          <div className="flex items-center justify-between text-red-400">
            <span className="text-xs font-medium">Down</span>
            <AlertOctagon className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold font-mono text-red-400">
              {summary?.down_count ?? 0}
            </div>
            <div className="text-[10px] sm:text-[11px] text-[#8892a4] truncate">Unreachable Nodes</div>
          </div>
        </div>

        {/* Affected by Upstream */}
        <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-[#2a3a52] transition">
          <div className="flex items-center justify-between text-purple-400">
            <span className="text-xs font-medium">RCA Suppressed</span>
            <Layers className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold font-mono text-purple-400">
              {summary?.affected_count ?? 0}
            </div>
            <div className="text-[10px] sm:text-[11px] text-[#8892a4] truncate">Downstream Tree</div>
          </div>
        </div>

        {/* Average Latency */}
        <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-[#2a3a52] transition">
          <div className="flex items-center justify-between text-[#8892a4]">
            <span className="text-xs font-medium">Avg RTT</span>
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold font-mono text-white">
              {summary?.avg_network_latency || 0}
              <span className="text-xs font-normal text-[#8892a4] ml-1">ms</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-[#8892a4] truncate">Fleet Response</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#151d2e] p-3 rounded-xl border border-[#1e2d45]">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8892a4] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by hostname, IP, brand, zone or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-white placeholder-[#8892a4] focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Status and Zone Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <div className="flex items-center gap-1 bg-[#0f1522] p-1 rounded-lg border border-[#1e2d45] text-xs">
            {['all', 'core', 'distribution', 'access', 'cctv', 'iot'].map((zone) => (
              <button
                key={zone}
                onClick={() => setSelectedZone(zone)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium uppercase whitespace-nowrap transition ${
                  selectedZone === zone
                    ? 'bg-[#1a2438] text-white border border-[#2a3a52]'
                    : 'text-[#8892a4] hover:text-white'
                }`}
              >
                {zone}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Device Telemetry Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredDevices.map((device) => {
          const poll = latestPolls[device.id];
          const status = poll?.status || 'unknown';
          const isPolling = pollingId === device.id;

          const rxBps =
            poll?.iface_data?.reduce((sum, iface) => sum + iface.rx_bps, 0) || 0;
          const rxMbps = Math.round((rxBps / 1_000_000) * 10) / 10;

          return (
            <div
              key={device.id}
              onClick={() => onSelectDevice(device)}
              className="bg-[#151d2e] hover:bg-[#1a2438] border border-[#1e2d45] hover:border-[#2a3a52] rounded-xl p-3.5 sm:p-4 transition-all duration-150 cursor-pointer flex flex-col justify-between group shadow-sm"
            >
              {/* Header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate flex-1">
                    <h4 className="font-bold text-sm text-white truncate group-hover:text-emerald-300 transition">
                      {device.name}
                    </h4>
                    <div className="text-xs font-mono text-[#8892a4] flex items-center gap-1.5 mt-0.5 truncate">
                      <span>{device.ip}</span>
                      <span>•</span>
                      <span className="capitalize">{device.brand}</span>
                    </div>
                  </div>
                  <div className="shrink-0">{getStatusBadge(status)}</div>
                </div>

                {/* Location and Zone */}
                <div className="mt-2.5 flex items-center justify-between text-xs text-[#8892a4]">
                  <span className="truncate max-w-[160px] text-[11px]">{device.location}</span>
                  <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-[#0f1522] border border-[#1e2d45] font-mono text-emerald-400">
                    {device.zone}
                  </span>
                </div>
              </div>

              {/* Real-time Telemetry Stats */}
              <div className="mt-3.5 pt-2.5 border-t border-[#1e2d45] grid grid-cols-4 gap-1.5 text-center text-xs">
                {/* Latency */}
                <div className="bg-[#0f1522] p-1 rounded-md border border-[#1e2d45]/60">
                  <div className="text-[9px] text-[#8892a4] uppercase font-mono">RTT</div>
                  <div className="font-mono font-bold text-emerald-400 text-xs mt-0.5">
                    {status === 'down' ? '—' : `${poll?.latency_ms || 0}ms`}
                  </div>
                </div>

                {/* CPU */}
                <div className="bg-[#0f1522] p-1 rounded-md border border-[#1e2d45]/60">
                  <div className="text-[9px] text-[#8892a4] uppercase font-mono">CPU</div>
                  <div className="font-mono font-bold text-white text-xs mt-0.5">
                    {status === 'down' ? '—' : `${poll?.cpu_pct || 0}%`}
                  </div>
                </div>

                {/* Memory */}
                <div className="bg-[#0f1522] p-1 rounded-md border border-[#1e2d45]/60">
                  <div className="text-[9px] text-[#8892a4] uppercase font-mono">RAM</div>
                  <div className="font-mono font-bold text-white text-xs mt-0.5">
                    {status === 'down' ? '—' : `${poll?.mem_pct || 0}%`}
                  </div>
                </div>

                {/* Throughput */}
                <div className="bg-[#0f1522] p-1 rounded-md border border-[#1e2d45]/60">
                  <div className="text-[9px] text-[#8892a4] uppercase font-mono">TRAFFIC</div>
                  <div className="font-mono font-bold text-blue-400 text-xs mt-0.5">
                    {status === 'down' ? '—' : `${rxMbps}M`}
                  </div>
                </div>
              </div>

              {/* Card Footer Action */}
              <div className="mt-3 flex items-center justify-between text-xs text-[#8892a4] pt-1">
                <span className="font-mono text-[10px] uppercase">
                  {device.protocol}
                </span>

                <button
                  onClick={(e) => handlePollNow(e, device.id)}
                  disabled={isPolling}
                  className="flex items-center gap-1 text-[11px] text-[#8892a4] hover:text-emerald-400 transition"
                  title="Poll immediately"
                >
                  <RefreshCw className={`w-3 h-3 ${isPolling ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>Poll</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Incident and Anomaly Stream */}
      <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1e2d45]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">Active Incident & Anomaly Stream</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#0f1522] text-[#8892a4] font-mono">
              {activeAlerts.length} Active
            </span>
          </div>

          {activeAlerts.length > 0 && (
            <button
              onClick={clearAlerts}
              className="text-xs text-[#8892a4] hover:text-white transition"
            >
              Clear All
            </button>
          )}
        </div>

        {activeAlerts.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#8892a4] flex flex-col items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <span>All systems running within normal operating parameters.</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                  alert.severity === 'critical'
                    ? 'bg-red-500/10 border-red-500/30 text-red-200'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate mr-2">
                  {alert.severity === 'critical' ? (
                    <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <div className="truncate">
                    <span className="font-semibold text-white mr-2">
                      {alert.message}
                    </span>
                    <span className="text-[10px] font-mono text-[#8892a4]">
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {!alert.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="px-2.5 py-1 bg-[#1a2438] hover:bg-[#202d46] text-white border border-[#2a3a52] rounded text-[11px] font-medium shrink-0 transition"
                  >
                    Ack
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

