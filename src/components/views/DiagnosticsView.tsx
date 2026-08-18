import React, { useState } from 'react';
import { useNetOps } from '../../context/NetOpsContext';
import {
  Wrench,
  Radio,
  GitCommit,
  Network,
  Globe,
  Gauge,
  Sparkles,
  Play,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  Cpu,
  Terminal,
  ShieldCheck,
  Zap,
  ArrowRight,
  ListChecks,
  FileText,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface ActionPlanSummary {
  incident_severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  root_cause: string;
  affected_systems: string[];
  immediate_steps: string[];
  cli_commands: Array<{ vendor: string; command: string; explanation: string }>;
  preventative_actions: string[];
}

interface DiagnosisResponse {
  raw_markdown: string;
  model_used: string;
  action_plan_summary?: ActionPlanSummary;
}

export const DiagnosticsView: React.FC<{ initialAiPrompt?: string }> = ({ initialAiPrompt }) => {
  const { devices } = useNetOps();
  const [activeTool, setActiveTool] = useState<
    'ping' | 'traceroute' | 'portscan' | 'dns' | 'speedtest' | 'ai'
  >(initialAiPrompt ? 'ai' : 'ping');

  // Tool states
  const [targetIp, setTargetIp] = useState(devices[0]?.ip || '192.168.1.1');
  const [pingCount, setPingCount] = useState(4);
  const [pingResult, setPingResult] = useState<any>(null);

  const [traceResult, setTraceResult] = useState<any>(null);

  const [portScanPorts, setPortScanPorts] = useState('22, 80, 443, 8291, 8728, 554, 161');
  const [portScanResult, setPortScanResult] = useState<any>(null);

  const [dnsQuery, setDnsQuery] = useState('router..lan');
  const [dnsType, setDnsType] = useState('A');
  const [dnsResult, setDnsResult] = useState<any>(null);

  const [speedResult, setSpeedResult] = useState<any>(null);

  // AI Assistant States
  const [aiPrompt, setAiPrompt] = useState(
    initialAiPrompt ||
      'Guests in  1 are experiencing intermittent Zoom drops. Living room AP has latency spikes.'
  );
  const [aiResponse, setAiResponse] = useState<DiagnosisResponse | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);
  const [copiedFull, setCopiedFull] = useState(false);

  const [loading, setLoading] = useState(false);

  // AI Presets
  const aiPresets = [
    {
      label: 'Site A WiFi Latency & Video Drops',
      prompt:
        'Users in Building A report video conference call drops. AP-01 latency fluctuates up to 180ms with 4% packet loss. Run root cause diagnosis and summarize step-by-step action plan.',
    },
    {
      label: 'CCTV Camera Stream Stuttering',
      prompt:
        'Security team reports CCTV-01 and CCTV-02 video streams are stuttering and dropping frames on Access Switch SW-02. Check PoE budget and buffer overflows.',
    },
    {
      label: 'Core Router High CPU & BGP Flapping',
      prompt:
        'Core Gateway CCR2004 CPU utilization spiked to 92% and WAN ping response is intermittent. Diagnose possible routing loop, DDoS, or ARP flood.',
    },
    {
      label: 'Fleet Real-Time Health & Action Plan',
      prompt:
        'Perform a comprehensive network health assessment across all 4 tiers (Core, Distribution, Access, and Edge). Highlight any single points of failure and formulate preventative action plan.',
    },
  ];

  // Handlers
  const handleRunPing = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tools/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: targetIp, count: Number(pingCount) }),
      }).then((r) => r.json());
      if (res.success) setPingResult(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleRunTrace = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tools/traceroute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: targetIp }),
      }).then((r) => r.json());
      if (res.success) setTraceResult(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleRunPortScan = async () => {
    setLoading(true);
    try {
      const ports = portScanPorts
        .split(',')
        .map((p) => parseInt(p.trim(), 10))
        .filter((p) => !isNaN(p));

      const res = await fetch('/api/tools/portscan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: targetIp, ports }),
      }).then((r) => r.json());
      if (res.success) setPortScanResult(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleRunDns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tools/dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: dnsQuery, type: dnsType }),
      }).then((r) => r.json());
      if (res.success) setDnsResult(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSpeedtest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tools/speedtest', { method: 'POST' }).then((r) => r.json());
      if (res.success) setSpeedResult(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAi = async (customPrompt?: string) => {
    const promptToUse = customPrompt || aiPrompt;
    setLoading(true);
    setCompletedSteps({});
    try {
      const res = await fetch('/api/tools/ai-troubleshoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptToUse }),
      }).then((r) => r.json());
      if (res.success && res.data) {
        if (typeof res.data === 'string') {
          setAiResponse({ raw_markdown: res.data, model_used: 'gemini-3.6-flash' });
        } else {
          setAiResponse(res.data);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, idx?: number) => {
    navigator.clipboard.writeText(text);
    if (idx !== undefined) {
      setCopiedCodeIdx(idx);
      setTimeout(() => setCopiedCodeIdx(null), 2000);
    } else {
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2000);
    }
  };

  const toggleStep = (idx: number) => {
    setCompletedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1 bg-[#151d2e] p-1.5 rounded-xl border border-[#1e2d45] overflow-x-auto">
        <button
          onClick={() => setActiveTool('ai')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeTool === 'ai'
              ? 'bg-gradient-to-r from-emerald-600 to-blue-600 text-white shadow-md'
              : 'text-[#8892a4] hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <span>Gemini AI Assistant & Action Plan</span>
        </button>

        <button
          onClick={() => setActiveTool('ping')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition ${
            activeTool === 'ping'
              ? 'bg-[#1a2438] text-white border border-[#2a3a52]'
              : 'text-[#8892a4] hover:text-white'
          }`}
        >
          <Radio className="w-4 h-4 text-emerald-400" />
          <span>Live Ping</span>
        </button>

        <button
          onClick={() => setActiveTool('traceroute')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition ${
            activeTool === 'traceroute'
              ? 'bg-[#1a2438] text-white border border-[#2a3a52]'
              : 'text-[#8892a4] hover:text-white'
          }`}
        >
          <GitCommit className="w-4 h-4 text-blue-400" />
          <span>Traceroute</span>
        </button>

        <button
          onClick={() => setActiveTool('portscan')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition ${
            activeTool === 'portscan'
              ? 'bg-[#1a2438] text-white border border-[#2a3a52]'
              : 'text-[#8892a4] hover:text-white'
          }`}
        >
          <Network className="w-4 h-4 text-amber-400" />
          <span>Port Scanner</span>
        </button>

        <button
          onClick={() => setActiveTool('dns')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition ${
            activeTool === 'dns'
              ? 'bg-[#1a2438] text-white border border-[#2a3a52]'
              : 'text-[#8892a4] hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4 text-purple-400" />
          <span>DNS Lookup</span>
        </button>

        <button
          onClick={() => setActiveTool('speedtest')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition ${
            activeTool === 'speedtest'
              ? 'bg-[#1a2438] text-white border border-[#2a3a52]'
              : 'text-[#8892a4] hover:text-white'
          }`}
        >
          <Gauge className="w-4 h-4 text-cyan-400" />
          <span>Speedtest</span>
        </button>
      </div>

      {/* 1. AI NetOps Assistant & Action Plan Summary (PRIMARY TAB) */}
      {activeTool === 'ai' && (
        <div className="space-y-4">
          {/* Main AI Prompt Box */}
          <div className="bg-[#151d2e] border border-[#1e2d45] rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#1e2d45]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-base">Gemini AI Assistant</h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse-green" />
                      Gemini 3.6 Flash
                    </span>
                  </div>
                  <p className="text-xs text-[#8892a4]">
                    Real-time diagnosis, Root Cause Analysis correlation, and next action plan summarizer
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleRunAi()}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shrink-0"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                )}
                <span>{loading ? 'Analyzing Topology...' : 'Run AI Diagnosis'}</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div>
              <div className="text-[11px] font-semibold text-[#8892a4] mb-2 uppercase tracking-wider">
                Quick Incident Scenarios:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {aiPresets.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setAiPrompt(p.prompt);
                      handleRunAi(p.prompt);
                    }}
                    className="p-2.5 bg-[#0f1522] hover:bg-[#1a2438] border border-[#1e2d45] hover:border-emerald-500/50 rounded-xl text-left transition group"
                  >
                    <div className="font-semibold text-xs text-white group-hover:text-emerald-400 flex items-center justify-between">
                      <span>{p.label}</span>
                      <ArrowRight className="w-3 h-3 text-[#8892a4] group-hover:translate-x-0.5 transition" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">
                Describe Network Symptoms, Telemetry Anomalies, or Guest Complaints:
              </label>
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0f1522] border border-[#1e2d45] rounded-xl text-xs text-white placeholder-[#8892a4] focus:outline-none focus:border-emerald-500 transition font-mono leading-relaxed"
                placeholder="e.g. Guest in  2 reports that their Apple TV keeps buffering. Living room switch reports 4% packet loss."
              />
            </div>
          </div>

          {/* AI Result Presentation */}
          {aiResponse && (
            <div className="space-y-4">
              {/* Executive Summary & Action Plan Cards */}
              {aiResponse.action_plan_summary && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Card 1: Root Cause & Severity */}
                  <div className="bg-[#151d2e] border border-[#1e2d45] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8892a4]">
                        Incident Severity
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                          aiResponse.action_plan_summary.incident_severity === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40 status-pulse-red'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        }`}
                      >
                        {aiResponse.action_plan_summary.incident_severity}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs text-[#8892a4]">Identified Root Cause:</div>
                      <div className="font-bold text-sm text-white mt-0.5 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="truncate">{aiResponse.action_plan_summary.root_cause}</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-[#8892a4] mb-1">Affected Infrastructure:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {aiResponse.action_plan_summary.affected_systems.map((sys, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-[#0f1522] border border-[#1e2d45] text-white rounded text-[11px] font-mono"
                          >
                            {sys}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Interactive Next Action Checklist */}
                  <div className="lg:col-span-2 bg-[#151d2e] border border-[#1e2d45] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-emerald-400" />
                        <h5 className="font-bold text-white text-xs uppercase tracking-wider">
                          Immediate Action Plan Checklist (On-Site IT Officer)
                        </h5>
                      </div>
                      <span className="text-[10px] font-mono text-[#8892a4]">
                        {Object.values(completedSteps).filter(Boolean).length} /{' '}
                        {aiResponse.action_plan_summary.immediate_steps.length} Done
                      </span>
                    </div>

                    <div className="space-y-2">
                      {aiResponse.action_plan_summary.immediate_steps.map((step, idx) => {
                        const isDone = !!completedSteps[idx];
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleStep(idx)}
                            className={`p-2.5 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                              isDone
                                ? 'bg-emerald-950/20 border-emerald-500/40 text-[#8892a4] line-through'
                                : 'bg-[#0f1522] border-[#1e2d45] hover:border-[#2a3a52] text-[#e2e8f0]'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center transition shrink-0 ${
                                isDone
                                  ? 'bg-emerald-500 border-emerald-400 text-black'
                                  : 'border-[#4a5568] bg-[#151d2e]'
                              }`}
                            >
                              {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className="text-xs leading-relaxed">{step}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Vendor-Specific Remediation CLI Snippets */}
              {aiResponse.action_plan_summary?.cli_commands &&
                aiResponse.action_plan_summary.cli_commands.length > 0 && (
                  <div className="bg-[#151d2e] border border-[#1e2d45] rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-cyan-400" />
                        <h5 className="font-bold text-white text-sm">
                          Vendor CLI Diagnostic & Remediation Commands
                        </h5>
                      </div>
                      <span className="text-[11px] font-mono text-[#8892a4]">Ready to Copy & Run</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {aiResponse.action_plan_summary.cli_commands.map((cmd, idx) => (
                        <div
                          key={idx}
                          className="bg-[#0b101b] border border-[#1e2d45] rounded-xl p-3.5 space-y-2 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-xs text-emerald-400">{cmd.vendor}</span>
                              <button
                                onClick={() => copyToClipboard(cmd.command, idx)}
                                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#151d2e] hover:bg-[#1a2438] text-[#8892a4] hover:text-white transition"
                              >
                                {copiedCodeIdx === idx ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy CLI</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="text-[11px] text-[#8892a4] mb-2">{cmd.explanation}</p>
                          </div>

                          <pre className="p-2.5 bg-[#070b12] rounded-lg border border-[#1a2438] text-[11px] font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {cmd.command}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Full Technical Diagnosis Markdown */}
              <div className="bg-[#151d2e] border border-[#1e2d45] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#1e2d45]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <h5 className="font-bold text-white text-sm">Full Technical Diagnosis Blueprint</h5>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(aiResponse.raw_markdown)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-[#0f1522] hover:bg-[#1a2438] border border-[#1e2d45] text-white rounded-lg text-xs font-semibold transition"
                    >
                      {copiedFull ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Blueprint Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Report</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-[#0a0e17] border border-[#1e2d45] rounded-xl p-4 sm:p-5 text-xs text-[#e2e8f0] leading-relaxed whitespace-pre-wrap font-sans space-y-4">
                  {aiResponse.raw_markdown}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Live Ping Tool */}
      {activeTool === 'ping' && (
        <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-white text-sm">Live ICMP Echo Ping Probe</h4>
              <p className="text-xs text-[#8892a4]">Measure round-trip time, packet loss, and jitter</p>
            </div>

            <button
              onClick={handleRunPing}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{loading ? 'Pinging Target...' : 'Send ICMP Echo'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs text-[#8892a4] mb-1">Target Device or IP:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetIp}
                  onChange={(e) => setTargetIp(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-white font-mono"
                  placeholder="192.168.1.1"
                />
                <select
                  onChange={(e) => setTargetIp(e.target.value)}
                  value={targetIp}
                  className="px-2 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-[#8892a4]"
                >
                  <option value="">Quick select node...</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.ip}>
                      {d.name} ({d.ip})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#8892a4] mb-1">Echo Count:</label>
              <select
                value={pingCount}
                onChange={(e) => setPingCount(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-white font-mono"
              >
                <option value={4}>4 packets</option>
                <option value={8}>8 packets</option>
                <option value={16}>16 packets</option>
              </select>
            </div>
          </div>

          {pingResult && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-[#0f1522] border border-[#1e2d45] p-3 rounded-lg text-center">
                  <div className="text-[10px] text-[#8892a4] uppercase font-mono">Packet Loss</div>
                  <div
                    className={`text-lg font-bold font-mono ${
                      pingResult.packet_loss_pct > 0 ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {pingResult.packet_loss_pct}%
                  </div>
                </div>
                <div className="bg-[#0f1522] border border-[#1e2d45] p-3 rounded-lg text-center">
                  <div className="text-[10px] text-[#8892a4] uppercase font-mono">Avg Latency</div>
                  <div className="text-lg font-bold font-mono text-cyan-400">{pingResult.avg_ms} ms</div>
                </div>
                <div className="bg-[#0f1522] border border-[#1e2d45] p-3 rounded-lg text-center">
                  <div className="text-[10px] text-[#8892a4] uppercase font-mono">Min / Max</div>
                  <div className="text-lg font-bold font-mono text-white">
                    {pingResult.min_ms} / {pingResult.max_ms} ms
                  </div>
                </div>
                <div className="bg-[#0f1522] border border-[#1e2d45] p-3 rounded-lg text-center">
                  <div className="text-[10px] text-[#8892a4] uppercase font-mono">Jitter</div>
                  <div className="text-lg font-bold font-mono text-amber-400">{pingResult.jitter_ms} ms</div>
                </div>
              </div>

              <div className="bg-[#0a0e17] border border-[#1e2d45] rounded-xl p-3 font-mono text-xs space-y-1 text-[#8892a4]">
                <div className="text-white pb-1 border-b border-[#1e2d45]">
                  Probing {pingResult.ip} with 64 bytes of ICMP data:
                </div>
                {pingResult.sequence.map((seq: any) => (
                  <div key={seq.seq} className="text-emerald-400">
                    64 bytes from {pingResult.ip}: icmp_seq={seq.seq} ttl={seq.ttl} time={seq.time_ms} ms
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Traceroute Tool */}
      {activeTool === 'traceroute' && (
        <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-white text-sm">Visual Hop-by-Hop Traceroute</h4>
              <p className="text-xs text-[#8892a4]">Discover network routing path and upstream gateway latency</p>
            </div>

            <button
              onClick={handleRunTrace}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{loading ? 'Tracing Route...' : 'Start Traceroute'}</span>
            </button>
          </div>

          <div>
            <label className="block text-xs text-[#8892a4] mb-1">Target Host or IP:</label>
            <input
              type="text"
              value={targetIp}
              onChange={(e) => setTargetIp(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-white font-mono"
            />
          </div>

          {traceResult && (
            <div className="bg-[#0a0e17] border border-[#1e2d45] rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="text-white pb-2 border-b border-[#1e2d45]">
                traceroute to {traceResult.target} (30 hops max):
              </div>
              <div className="space-y-2">
                {traceResult.hops.map((hop: any) => (
                  <div key={hop.hop} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-[#8892a4] font-bold">#{hop.hop}</span>
                      <span className="text-white">{hop.hostname || hop.ip}</span>
                      <span className="text-[10px] text-[#8892a4]">({hop.ip})</span>
                    </div>
                    <div className="text-emerald-400 font-bold">
                      {hop.rtt1} ms <span className="text-[#8892a4] font-normal">•</span> {hop.rtt2} ms{' '}
                      <span className="text-[#8892a4] font-normal">•</span> {hop.rtt3} ms
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Port Scanner */}
      {activeTool === 'portscan' && (
        <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-white text-sm">TCP Port & Service Audit Scanner</h4>
              <p className="text-xs text-[#8892a4]">Scan common management, streaming, and API ports</p>
            </div>

            <button
              onClick={handleRunPortScan}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{loading ? 'Scanning Ports...' : 'Scan Ports'}</span>
            </button>
          </div>

          <div>
            <label className="block text-xs text-[#8892a4] mb-1">Ports to probe (comma-separated):</label>
            <input
              type="text"
              value={portScanPorts}
              onChange={(e) => setPortScanPorts(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-white font-mono"
            />
          </div>

          {portScanResult && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
              {portScanResult.results.map((res: any) => (
                <div
                  key={res.port}
                  className={`p-2.5 rounded-lg border flex items-center justify-between text-xs font-mono ${
                    res.state === 'open'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-[#0f1522] border-[#1e2d45] text-[#8892a4]'
                  }`}
                >
                  <div>
                    <span className="font-bold">Port {res.port}</span>
                    <span className="text-[10px] block text-[#8892a4]">{res.service}</span>
                  </div>
                  <span
                    className={`uppercase font-bold text-[10px] px-2 py-0.5 rounded ${
                      res.state === 'open' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#151d2e] text-[#8892a4]'
                    }`}
                  >
                    {res.state}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. DNS Lookup */}
      {activeTool === 'dns' && (
        <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-white text-sm">DNS Record Inspector</h4>
              <p className="text-xs text-[#8892a4]">Query local MikroTik DNS cache or public resolvers</p>
            </div>

            <button
              onClick={handleRunDns}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{loading ? 'Resolving...' : 'Lookup DNS'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs text-[#8892a4] mb-1">Hostname or IP:</label>
              <input
                type="text"
                value={dnsQuery}
                onChange={(e) => setDnsQuery(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8892a4] mb-1">Record Type:</label>
              <select
                value={dnsType}
                onChange={(e) => setDnsType(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-white font-mono"
              >
                <option value="A">A (IPv4)</option>
                <option value="AAAA">AAAA (IPv6)</option>
                <option value="MX">MX (Mail)</option>
                <option value="TXT">TXT</option>
                <option value="PTR">PTR (Reverse)</option>
              </select>
            </div>
          </div>

          {dnsResult && (
            <div className="bg-[#0a0e17] border border-[#1e2d45] rounded-xl p-3 font-mono text-xs space-y-2">
              <div className="text-[#8892a4] flex justify-between border-b border-[#1e2d45] pb-2">
                <span>Resolver: {dnsResult.server}</span>
                <span>Response: {dnsResult.response_time_ms} ms</span>
              </div>
              {dnsResult.records.map((rec: any, idx: number) => (
                <div key={idx} className="flex justify-between text-emerald-400">
                  <span>
                    {rec.name} IN {rec.type} {rec.ttl}s
                  </span>
                  <span className="font-bold text-white">{rec.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Speedtest */}
      {activeTool === 'speedtest' && (
        <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-white text-sm">WAN Fiber & Local Bandwidth Speedtest</h4>
              <p className="text-xs text-[#8892a4]">Measure uplink throughput and burst capacity</p>
            </div>

            <button
              onClick={handleRunSpeedtest}
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold shadow-lg transition"
            >
              <Play className="w-4 h-4" />
              <span>{loading ? 'Testing Throughput...' : 'Run Speedtest'}</span>
            </button>
          </div>

          {speedResult && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Download */}
                <div className="bg-[#0f1522] border border-[#1e2d45] rounded-xl p-4 text-center">
                  <div className="text-xs text-[#8892a4] uppercase font-medium">Download Bandwidth</div>
                  <div className="text-3xl font-bold font-mono text-cyan-400 mt-2">
                    {speedResult.download_mbps}
                    <span className="text-xs text-[#8892a4] ml-1">Mbps</span>
                  </div>
                </div>

                {/* Upload */}
                <div className="bg-[#0f1522] border border-[#1e2d45] rounded-xl p-4 text-center">
                  <div className="text-xs text-[#8892a4] uppercase font-medium">Upload Bandwidth</div>
                  <div className="text-3xl font-bold font-mono text-emerald-400 mt-2">
                    {speedResult.upload_mbps}
                    <span className="text-xs text-[#8892a4] ml-1">Mbps</span>
                  </div>
                </div>

                {/* Ping */}
                <div className="bg-[#0f1522] border border-[#1e2d45] rounded-xl p-4 text-center">
                  <div className="text-xs text-[#8892a4] uppercase font-medium">Latency & Jitter</div>
                  <div className="text-3xl font-bold font-mono text-white mt-2">
                    {speedResult.ping_ms}
                    <span className="text-xs text-[#8892a4] ml-1">ms (±{speedResult.jitter_ms}ms)</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#0a0e17] border border-[#1e2d45] rounded-lg text-xs text-[#8892a4] flex justify-between font-mono">
                <span>ISP: {speedResult.isp}</span>
                <span>Server: {speedResult.server}</span>
                <span>WAN IP: {speedResult.wan_ip}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
