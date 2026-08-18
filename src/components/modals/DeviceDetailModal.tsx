import React, { useState, useEffect } from 'react';
import { Device, PollResult } from '../../types/netops';
import { useNetOps } from '../../context/NetOpsContext';
import {
  Server,
  Activity,
  Cpu,
  HardDrive,
  Radio,
  ArrowDownUp,
  RefreshCw,
  Zap,
  Play,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  X,
  Trash2,
} from 'lucide-react';

interface DeviceDetailModalProps {
  device: Device;
  onClose: () => void;
  onOpenDiagnostics: (ip: string) => void;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({
  device,
  onClose,
  onOpenDiagnostics,
}) => {
  const { latestPolls, pollDeviceNow, toggleSimFailure, devices, deleteDevice } = useNetOps();
  const [history, setHistory] = useState<PollResult[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const poll = latestPolls[device.id];
  const status = poll?.status || 'unknown';
  const parent = devices.find((d) => d.id === device.upstream_id);

  useEffect(() => {
    fetch(`/api/devices/${device.id}/history`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setHistory(r.data);
      });
  }, [device.id]);

  const handlePoll = async () => {
    setIsPolling(true);
    try {
      await pollDeviceNow(device.id);
      const res = await fetch(`/api/devices/${device.id}/history`).then((r) => r.json());
      if (res.success) setHistory(res.data);
    } finally {
      setIsPolling(false);
    }
  };

  const formatUptime = (sec?: number) => {
    if (!sec) return '—';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="bg-[#151d2e] border border-[#2a3a52] rounded-2xl w-full max-w-3xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#1e2d45]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f1522] border border-[#1e2d45] flex items-center justify-center text-emerald-400 shadow-inner">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">{device.name}</h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    status === 'up'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : status === 'down'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {status}
                </span>
              </div>
              <div className="text-xs font-mono text-[#8892a4] flex items-center gap-2 mt-0.5">
                <span>{device.ip}</span>
                <span>•</span>
                <span>{device.mac || 'No MAC'}</span>
                <span>•</span>
                <span className="capitalize">{device.brand}</span>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="text-[#8892a4] hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <div className="bg-[#0f1522] p-3 rounded-xl border border-[#1e2d45]">
            <div className="text-[10px] text-[#8892a4] uppercase font-medium">Round-Trip Latency</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {status === 'down' ? '—' : `${poll?.latency_ms || 0} ms`}
            </div>
          </div>

          <div className="bg-[#0f1522] p-3 rounded-xl border border-[#1e2d45]">
            <div className="text-[10px] text-[#8892a4] uppercase font-medium">CPU Utilization</div>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {status === 'down' ? '—' : `${poll?.cpu_pct || 0} %`}
            </div>
          </div>

          <div className="bg-[#0f1522] p-3 rounded-xl border border-[#1e2d45]">
            <div className="text-[10px] text-[#8892a4] uppercase font-medium">Memory Usage</div>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {status === 'down' ? '—' : `${poll?.mem_pct || 0} %`}
            </div>
          </div>

          <div className="bg-[#0f1522] p-3 rounded-xl border border-[#1e2d45]">
            <div className="text-[10px] text-[#8892a4] uppercase font-medium">System Uptime</div>
            <div className="text-sm font-bold font-mono text-blue-400 mt-1.5">
              {formatUptime(poll?.uptime_sec)}
            </div>
          </div>
        </div>

        {/* Hardware & Dependency Details */}
        <div className="bg-[#0f1522] border border-[#1e2d45] rounded-xl p-4 text-xs space-y-2">
          <div className="font-semibold text-white pb-1 border-b border-[#1e2d45]">
            Topology & Device Attributes
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#8892a4]">
            <div>
              Location: <span className="text-white font-medium">{device.location}</span>
            </div>
            <div>
              Network Zone: <span className="text-white font-mono uppercase">{device.zone}</span>
            </div>
            <div>
              Polling Protocol:{' '}
              <span className="text-blue-400 font-mono uppercase">{device.protocol}</span>
            </div>
            <div>
              Upstream Parent:{' '}
              <span className="text-emerald-400 font-medium">
                {parent ? `${parent.name} (${parent.ip})` : 'Root Gateway (Core)'}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Interface Traffic */}
        {poll?.iface_data && poll.iface_data.length > 0 && (
          <div className="bg-[#0f1522] border border-[#1e2d45] rounded-xl p-4 text-xs space-y-2">
            <div className="font-semibold text-white pb-1 border-b border-[#1e2d45] flex items-center justify-between">
              <span>Port & Interface Traffic</span>
              <span className="text-[10px] text-[#8892a4] font-mono">SNMP / RouterOS Live</span>
            </div>
            <div className="space-y-2">
              {poll.iface_data.map((iface) => (
                <div
                  key={iface.name}
                  className="flex items-center justify-between p-2 rounded bg-[#151d2e] border border-[#1e2d45]"
                >
                  <span className="font-mono text-white font-semibold">{iface.name}</span>
                  <div className="flex items-center gap-4 font-mono text-[11px]">
                    <span className="text-emerald-400">
                      ↓ {Math.round((iface.rx_bps / 1_000_000) * 10) / 10} Mbps
                    </span>
                    <span className="text-blue-400">
                      ↑ {Math.round((iface.tx_bps / 1_000_000) * 10) / 10} Mbps
                    </span>
                    <span className="text-emerald-400 text-[10px] uppercase font-bold">
                      {iface.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1e2d45]">
          <div className="flex gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenDiagnostics(device.ip);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f1522] hover:bg-[#1a2438] text-white border border-[#1e2d45] rounded-lg text-xs font-medium transition"
            >
              <Play className="w-3.5 h-3.5 text-blue-400" />
              <span>Launch Diagnostics</span>
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Node</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handlePoll}
              disabled={isPolling}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
              <span>{isPolling ? 'Polling...' : 'Poll Now'}</span>
            </button>
          </div>
        </div>

        {/* Delete Confirmation Sub-modal */}
        {confirmDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
            <div className="bg-[#151d2e] border border-[#2a3a52] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Confirm Device Deletion</h3>
                  <p className="text-xs text-[#8892a4] mt-0.5">
                    Remove <strong className="text-white">{device.name}</strong> ({device.ip}) from the inventory?
                  </p>
                </div>
              </div>

              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-red-300">
                This will unbind downstream dependencies and remove polling telemetry history.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1e2d45]">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-[#0f1522] hover:bg-[#1a2438] text-[#8892a4] hover:text-white rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await deleteDevice(device.id);
                      setConfirmDelete(false);
                      onClose();
                    } catch (err) {
                      console.error('Failed to delete device:', err);
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
