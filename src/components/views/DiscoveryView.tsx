import React, { useState } from 'react';
import { useNetOps } from '../../context/NetOpsContext';
import { DiscoveryHost, DiscoveryScanSession } from '../../types/netops';
import {
  Radar,
  Play,
  CheckCircle2,
  Plus,
  Server,
  Activity,
  Layers,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { Pagination } from '../ui/Pagination';

export const DiscoveryView: React.FC = () => {
  const { devices, addDevice } = useNetOps();
  const [subnet, setSubnet] = useState('192.168.1.0/24');
  const [isScanning, setIsScanning] = useState(false);
  const [currentSession, setCurrentSession] = useState<DiscoveryScanSession | null>(null);
  const [importedIps, setImportedIps] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const handleStartScan = async () => {
    setIsScanning(true);
    setCurrentPage(1);
    try {
      const res = await fetch('/api/discovery/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnet }),
      }).then((r) => r.json());

      if (res.success) {
        setCurrentSession(res.data);
        pollScanProgress(res.data.scan_id);
      }
    } catch (err) {
      console.error('[Discovery] scan error:', err);
      setIsScanning(false);
    }
  };

  const pollScanProgress = (scanId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/discovery/results/${scanId}`).then((r) => r.json());
        if (res.success) {
          setCurrentSession(res.data);
          if (res.data.status === 'completed' || res.data.status === 'failed') {
            clearInterval(interval);
            setIsScanning(false);
          }
        }
      } catch {
        clearInterval(interval);
        setIsScanning(false);
      }
    }, 500);
  };

  const handleImportHost = async (host: DiscoveryHost) => {
    try {
      await addDevice({
        name: host.hostname || `Discovered-${host.ip.replace(/\./g, '-')}`,
        ip: host.ip,
        mac: host.mac || '',
        vendor: host.vendor || 'Generic',
        brand: host.estimated_brand || 'generic',
        type: host.estimated_type || 'other',
        protocol: host.suggested_protocol || 'icmp',
        location: 'Auto-Discovered',
        zone: 'access',
        tags: ['auto-discovered'],
        enabled: true,
      });

      setImportedIps((prev) => new Set(prev).add(host.ip));
    } catch (err) {
      console.error('Failed to import host:', err);
    }
  };

  const isAlreadyInInventory = (ip: string) => {
    return devices.some((d) => d.ip === ip) || importedIps.has(ip);
  };

  const progressPct = currentSession
    ? Math.round((currentSession.scanned_ips / currentSession.total_ips) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Scanner Control Header */}
      <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#1e2d45]">
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Radar className="w-4 h-4 text-emerald-400" />
              Subnet IP & Device Discovery Engine
            </h3>
            <p className="text-xs text-[#8892a4]">
              Parallel ARP / ICMP sweep with MAC OUI vendor resolution and port fingerprinting
            </p>
          </div>

          {/* Quick Subnet Presets */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#8892a4] text-[11px]">Presets:</span>
            {['192.168.1.0/24', '10.20.0.0/24', '172.16.1.0/24'].map((p) => (
              <button
                key={p}
                onClick={() => setSubnet(p)}
                className="px-2 py-0.5 rounded bg-[#0f1522] hover:bg-[#1a2438] text-[#8892a4] hover:text-white border border-[#1e2d45] text-[11px] font-mono transition"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input and Scan Trigger */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              placeholder="e.g. 192.168.1.0/24"
              disabled={isScanning}
              className="w-full px-4 py-2 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-sm text-white font-mono placeholder-[#8892a4] focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleStartScan}
            disabled={isScanning}
            className={`flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-xs font-bold text-white shadow-md transition ${
              isScanning
                ? 'bg-blue-600/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500'
            }`}
          >
            {isScanning ? (
              <>
                <Activity className="w-4 h-4 animate-spin text-white" />
                <span>Scanning Subnet ({progressPct}%)...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Start Discovery Scan</span>
              </>
            )}
          </button>
        </div>

        {/* Progress Bar */}
        {currentSession && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-[#8892a4]">
              <span>
                Scanned {currentSession.scanned_ips} of {currentSession.total_ips} addresses
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {currentSession.found_hosts.length} Hosts Discovered
              </span>
            </div>
            <div className="w-full bg-[#0f1522] h-2 rounded-full overflow-hidden border border-[#1e2d45]">
              <div
                style={{ width: `${progressPct}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-200"
              />
            </div>
          </div>
        )}
      </div>

      {/* Discovered Hosts Grid */}
      {currentSession && currentSession.found_hosts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#8892a4] px-1">
            <span className="font-semibold text-white">Discovered Devices & Fingerprints</span>
            <span>Click "+ Import" to add any discovered hardware to live monitoring</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentSession.found_hosts.map((host) => {
              const alreadyMonitored = isAlreadyInInventory(host.ip);

              return (
                <div
                  key={host.ip}
                  className="bg-[#151d2e] border border-[#1e2d45] hover:border-[#2a3a52] rounded-xl p-4 flex flex-col justify-between space-y-3 shadow transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-white">
                          {host.hostname || 'Unassigned Host'}
                        </h4>
                        <div className="text-xs font-mono text-emerald-400 mt-0.5">
                          {host.ip}
                        </div>
                      </div>

                      {alreadyMonitored ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          MONITORED
                        </span>
                      ) : (
                        <button
                          onClick={() => handleImportHost(host)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Import</span>
                        </button>
                      )}
                    </div>

                    {/* Fingerprint details */}
                    <div className="mt-3 space-y-1 text-xs text-[#8892a4]">
                      <div className="flex justify-between">
                        <span>Hardware Vendor:</span>
                        <span className="text-white font-medium">{host.vendor || 'Generic'}</span>
                      </div>
                      <div className="flex justify-between font-mono text-[11px]">
                        <span>MAC OUI:</span>
                        <span className="text-[#8892a4]">{host.mac || '—'}</span>
                      </div>
                    </div>

                    {/* Open Ports */}
                    <div className="mt-3 pt-2 border-t border-[#1e2d45]">
                      <span className="text-[10px] uppercase text-[#8892a4] font-medium block mb-1">
                        Open Probed Ports:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {host.open_ports.map((port) => (
                          <span
                            key={port}
                            className="px-1.5 py-0.5 rounded bg-[#0f1522] border border-[#1e2d45] text-[10px] font-mono text-blue-300"
                          >
                            Port {port}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
