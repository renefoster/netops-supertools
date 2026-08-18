import React, { useState, useEffect } from 'react';
import { useNetOps } from '../../context/NetOpsContext';
import { DeviceBackup, BackupSchedule } from '../../types/netops';
import {
  FileCode,
  Download,
  Plus,
  Play,
  GitCompare,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { Pagination } from '../ui/Pagination';

export const BackupsView: React.FC = () => {
  const { devices } = useNetOps();
  const [backups, setBackups] = useState<DeviceBackup[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(devices[0]?.id || '');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [viewingBackup, setViewingBackup] = useState<DeviceBackup | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Diff states
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [diffOldId, setDiffOldId] = useState('');
  const [diffNewId, setDiffNewId] = useState('');
  const [diffResult, setDiffResult] = useState<any>(null);

  const fetchBackups = async () => {
    if (!selectedDevice) return;
    try {
      const [bkRes, schRes] = await Promise.all([
        fetch(`/api/backup/${selectedDevice}/list`).then((r) => r.json()),
        fetch('/api/backup/schedules').then((r) => r.json()),
      ]);

      if (bkRes.success) setBackups(bkRes.data);
      if (schRes.success) setSchedules(schRes.data);
    } catch (err) {
      console.error('[Backups] fetch error:', err);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [selectedDevice]);

  const handleRunBackup = async () => {
    if (!selectedDevice) return;
    setIsBackingUp(true);
    try {
      const res = await fetch(`/api/backup/run/${selectedDevice}`, {
        method: 'POST',
      }).then((r) => r.json());

      if (res.success) {
        setBackups((prev) => [res.data, ...prev]);
        setViewingBackup(res.data);
      }
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRunDiff = async () => {
    if (!diffOldId || !diffNewId) return;
    try {
      const res = await fetch('/api/backup/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_id: diffOldId, new_id: diffNewId }),
      }).then((r) => r.json());

      if (res.success) {
        setDiffResult(res.data);
      }
    } catch (err) {
      console.error('[Backups] diff error:', err);
    }
  };

  const handleDownload = (backup: DeviceBackup) => {
    const element = document.createElement('a');
    const file = new Blob([backup.content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = backup.filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#151d2e] p-3.5 rounded-xl border border-[#1e2d45]">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            Device Configuration Vault & Automation Engine
          </h3>
          <p className="text-xs text-[#8892a4]">
            Automated RouterOS exports, Cisco running-config diffs, and scheduled snapshots
          </p>
        </div>

        <div className="flex items-center gap-2">
          {backups.length >= 2 && (
            <button
              onClick={() => {
                setDiffOldId(backups[1]?.id || '');
                setDiffNewId(backups[0]?.id || '');
                setIsDiffOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f1522] hover:bg-[#1a2438] text-white border border-[#1e2d45] rounded-lg text-xs font-medium transition"
            >
              <GitCompare className="w-3.5 h-3.5 text-blue-400" />
              <span>Side-by-Side Diff</span>
            </button>
          )}

          <button
            onClick={handleRunBackup}
            disabled={isBackingUp}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isBackingUp ? 'Pulling Config...' : 'Backup Config Now'}</span>
          </button>
        </div>
      </div>

      {/* Target Device Selector */}
      <div className="bg-[#151d2e] p-3 rounded-xl border border-[#1e2d45] flex items-center gap-3">
        <span className="text-xs text-[#8892a4] whitespace-nowrap">Select Device:</span>
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-white flex-1 focus:outline-none"
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {d.ip} ({d.brand.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {/* Backups List & Viewer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Backup Version History */}
        <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#1e2d45]">
            <span className="font-bold text-white text-xs">Version Snapshots</span>
            <span className="text-xs text-[#8892a4] font-mono">{backups.length} Saved</span>
          </div>

          {backups.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#8892a4]">
              No configuration snapshots found. Click "Backup Config Now" to pull the initial version.
            </div>
          ) : (
            <div className="space-y-2">
              {backups
                .slice((currentPage - 1) * 10, currentPage * 10)
                .map((bk) => (
                <div
                  key={bk.id}
                  onClick={() => setViewingBackup(bk)}
                  className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                    viewingBackup?.id === bk.id
                      ? 'bg-[#1a2438] border-emerald-500/50 text-white'
                      : 'bg-[#0f1522] border-[#1e2d45] text-[#8892a4] hover:text-white'
                  }`}
                >
                  <div className="truncate mr-2">
                    <div className="font-semibold text-xs text-white truncate">{bk.filename}</div>
                    <div className="text-[10px] font-mono text-[#8892a4] mt-0.5">
                      {new Date(bk.created_at).toLocaleString()} • {Math.round(bk.size_bytes / 1024)} KB
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(bk);
                    }}
                    className="p-1.5 hover:bg-[#151d2e] rounded text-[#8892a4] hover:text-emerald-400 transition"
                    title="Download raw file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <Pagination
                currentPage={currentPage}
                totalItems={backups.length}
                pageSize={10}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>

        {/* Configuration Text Viewer */}
        <div className="lg:col-span-2 bg-[#151d2e] border border-[#1e2d45] rounded-xl p-4 space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-[#1e2d45]">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white text-xs truncate">
                {viewingBackup ? viewingBackup.filename : 'Configuration Inspector'}
              </span>
            </div>

            {viewingBackup && (
              <button
                onClick={() => handleDownload(viewingBackup)}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save to Disk</span>
              </button>
            )}
          </div>

          <div className="bg-[#0a0e17] border border-[#1e2d45] rounded-lg p-3 font-mono text-xs text-[#00e5a0] overflow-auto max-h-96 min-h-[280px] whitespace-pre">
            {viewingBackup ? viewingBackup.content : '// Select a backup version on the left to inspect raw syntax'}
          </div>
        </div>
      </div>

      {/* Automated Schedules Card */}
      <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-4">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#1e2d45]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <h4 className="font-bold text-white text-xs">Automated Config Backup Schedules</h4>
          </div>
          <span className="text-xs text-emerald-400 font-mono">2 Active node-cron Jobs</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {schedules.map((sch) => (
            <div key={sch.id} className="p-3 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs space-y-1">
              <div className="font-semibold text-white">{sch.name}</div>
              <div className="text-[11px] font-mono text-blue-400">Cron: {sch.cron}</div>
              <div className="text-[10px] text-[#8892a4] flex justify-between pt-1">
                <span>Last run: {sch.last_run ? new Date(sch.last_run).toLocaleDateString() : '—'}</span>
                <span className="text-emerald-400 font-medium">ENABLED</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Side-by-Side Diff Modal */}
      {isDiffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="bg-[#151d2e] border border-[#2a3a52] rounded-2xl w-full max-w-4xl shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2d45]">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-blue-400" />
                Configuration Diff Engine (Side-by-Side)
              </h3>
              <button onClick={() => setIsDiffOpen(false)} className="text-[#8892a4] hover:text-white">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#8892a4] mb-1">Previous Version (Base):</label>
                <select
                  value={diffOldId}
                  onChange={(e) => setDiffOldId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-white"
                >
                  {backups.map((bk) => (
                    <option key={bk.id} value={bk.id}>
                      {bk.filename}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#8892a4] mb-1">Current Version (Compare):</label>
                <select
                  value={diffNewId}
                  onChange={(e) => setDiffNewId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-white"
                >
                  {backups.map((bk) => (
                    <option key={bk.id} value={bk.id}>
                      {bk.filename}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleRunDiff}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition"
              >
                Compute Diff
              </button>
            </div>

            {/* Diff Lines View */}
            <div className="flex-1 overflow-auto bg-[#0a0e17] border border-[#1e2d45] rounded-xl p-3 font-mono text-xs divide-y divide-[#1e2d45]/40">
              {diffResult ? (
                diffResult.diff_lines.map((line: any, idx: number) => (
                  <div
                    key={idx}
                    className={`py-0.5 px-2 flex gap-3 ${
                      line.type === 'added'
                        ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                        : line.type === 'removed'
                        ? 'bg-red-500/15 text-red-400 font-semibold line-through'
                        : 'text-[#8892a4]'
                    }`}
                  >
                    <span className="w-6 text-right select-none opacity-40">
                      {line.line_new || line.line_old}
                    </span>
                    <span className="w-3 select-none">
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    <span className="whitespace-pre">{line.content}</span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-[#8892a4]">
                  Click "Compute Diff" to calculate configuration changes between selected versions
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
