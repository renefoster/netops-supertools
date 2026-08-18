import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useNetOps } from '../../context/NetOpsContext';
import { Device, DeviceStatus, NetworkZone } from '../../types/netops';
import {
  GitFork,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  Search,
  Server,
  Radio,
  Camera,
  HardDrive,
  Cpu,
  Wifi,
  ShieldAlert,
  Info,
  RefreshCw,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  ChevronRight,
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
} from 'lucide-react';

interface TopologyViewProps {
  onSelectDevice: (device: Device) => void;
}

interface NodeCoord {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  topX: number;
  topY: number;
  bottomX: number;
  bottomY: number;
}

export const TopologyView: React.FC<TopologyViewProps> = ({ onSelectDevice }) => {
  const { devices, latestPolls, rcaResults, triggerPollAll, isPolling } = useNetOps();
  const [zoom, setZoom] = useState(1);
  const [highlightZone, setHighlightZone] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'issues' | 'up'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [nodeCoords, setNodeCoords] = useState<Map<string, NodeCoord>>(new Map());

  // Group devices into hierarchical tiers based on upstream_id
  const { tiers, links, rootDevices } = useMemo(() => {
    const tierMap: Record<number, Device[]> = { 0: [], 1: [], 2: [], 3: [] };
    const linksList: Array<{ id: string; from: Device; to: Device }> = [];
    const roots: Device[] = [];

    // Helper to calculate depth from root
    const getDepth = (dev: Device, visited = new Set<string>()): number => {
      if (!dev.upstream_id) return 0;
      if (visited.has(dev.id)) return 0;
      visited.add(dev.id);
      const parent = devices.find((d) => d.id === dev.upstream_id);
      if (!parent) return 1;
      return 1 + getDepth(parent, visited);
    };

    devices.forEach((dev) => {
      const depth = Math.min(3, getDepth(dev));
      if (!tierMap[depth]) tierMap[depth] = [];
      tierMap[depth].push(dev);

      if (!dev.upstream_id) {
        roots.push(dev);
      } else {
        const parent = devices.find((d) => d.id === dev.upstream_id);
        if (parent) {
          linksList.push({
            id: `${parent.id}->${dev.id}`,
            from: parent,
            to: dev,
          });
        }
      }
    });

    return { tiers: tierMap, links: linksList, rootDevices: roots };
  }, [devices]);

  // Compute exact coordinates of each node for SVG links
  const updateNodeCoordinates = () => {
    if (!canvasContentRef.current) return;
    const canvasRect = canvasContentRef.current.getBoundingClientRect();
    const newCoords = new Map<string, NodeCoord>();

    nodeRefs.current.forEach((el, id) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (rect.left - canvasRect.left) / zoom;
      const y = (rect.top - canvasRect.top) / zoom;
      const width = rect.width / zoom;
      const height = rect.height / zoom;

      newCoords.set(id, {
        id,
        x,
        y,
        width,
        height,
        topX: x + width / 2,
        topY: y,
        bottomX: x + width / 2,
        bottomY: y + height,
      });
    });

    setNodeCoords(newCoords);
  };

  useLayoutEffect(() => {
    updateNodeCoordinates();
  }, [devices, zoom, highlightZone, statusFilter, searchQuery]);

  useEffect(() => {
    const handleResize = () => {
      updateNodeCoordinates();
    };

    window.addEventListener('resize', handleResize);
    const timer = setTimeout(updateNodeCoordinates, 150);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  // Compute ancestry path (from selected/hovered node up to root)
  const activePathNodeIds = useMemo(() => {
    const targetId = hoveredNodeId || selectedNodeId;
    if (!targetId) return new Set<string>();

    const path = new Set<string>([targetId]);
    let current = devices.find((d) => d.id === targetId);

    // Walk upstream
    while (current && current.upstream_id) {
      path.add(current.upstream_id);
      current = devices.find((d) => d.id === current?.upstream_id);
    }

    // Walk downstream
    const queue = [targetId];
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const children = devices.filter((d) => d.upstream_id === parentId);
      children.forEach((c) => {
        path.add(c.id);
        queue.push(c.id);
      });
    }

    return path;
  }, [hoveredNodeId, selectedNodeId, devices]);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'router':
        return Cpu;
      case 'switch':
        return Server;
      case 'ap':
        return Wifi;
      case 'camera':
        return Camera;
      case 'nas':
        return HardDrive;
      default:
        return Radio;
    }
  };

  const getNodeColor = (status: DeviceStatus) => {
    switch (status) {
      case 'up':
        return {
          bg: 'bg-[#121c2b]',
          border: 'border-emerald-500/50 hover:border-emerald-400',
          text: 'text-emerald-400',
          dot: 'bg-emerald-400 status-pulse-green',
          glow: 'rgba(0, 229, 160, 0.25)',
          linkColor: '#00e5a0',
          linkGlow: 'rgba(0, 229, 160, 0.6)',
        };
      case 'down':
        return {
          bg: 'bg-red-950/40',
          border: 'border-red-500 hover:border-red-400',
          text: 'text-red-400',
          dot: 'bg-red-500 status-pulse-red',
          glow: 'rgba(239, 68, 68, 0.4)',
          linkColor: '#ef4444',
          linkGlow: 'rgba(239, 68, 68, 0.8)',
        };
      case 'degraded':
        return {
          bg: 'bg-amber-950/30',
          border: 'border-amber-500/60 hover:border-amber-400',
          text: 'text-amber-400',
          dot: 'bg-amber-400 status-pulse-amber',
          glow: 'rgba(245, 158, 11, 0.3)',
          linkColor: '#f59e0b',
          linkGlow: 'rgba(245, 158, 11, 0.6)',
        };
      case 'affected':
        return {
          bg: 'bg-purple-950/30',
          border: 'border-purple-500/50 hover:border-purple-400',
          text: 'text-purple-300',
          dot: 'bg-purple-400',
          glow: 'rgba(168, 85, 247, 0.25)',
          linkColor: '#a855f7',
          linkGlow: 'rgba(168, 85, 247, 0.6)',
        };
      default:
        return {
          bg: 'bg-[#151d2e]',
          border: 'border-[#1e2d45] hover:border-[#2a3a52]',
          text: 'text-[#8892a4]',
          dot: 'bg-slate-500',
          glow: 'transparent',
          linkColor: '#1e2d45',
          linkGlow: 'transparent',
        };
    }
  };

  const selectedDevice = useMemo(() => {
    return devices.find((d) => d.id === selectedNodeId) || null;
  }, [devices, selectedNodeId]);

  return (
    <div className="space-y-4">
      {/* Control & Filter Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-[#151d2e] p-3 sm:p-4 rounded-2xl border border-[#1e2d45] shadow-lg">
        {/* Left Title & Status */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span>Live Infrastructure Topology</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 status-pulse-green" />
            </h3>
            <p className="text-[11px] text-[#8892a4]">
              {devices.length} Nodes • {links.length} Active Real-Time Links with Dynamic Telemetry Light Streams
            </p>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Quick Search */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-[#8892a4] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search node or IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-white placeholder-[#8892a4] focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Zone Filter */}
          <div className="flex items-center gap-1 bg-[#0f1522] p-1 rounded-lg border border-[#1e2d45] text-xs">
            {['all', 'core', 'distribution', 'access', 'cctv', 'iot'].map((zone) => (
              <button
                key={zone}
                onClick={() => setHighlightZone(zone)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium uppercase transition ${
                  highlightZone === zone
                    ? 'bg-[#1a2438] text-white border border-[#2a3a52]'
                    : 'text-[#8892a4] hover:text-white'
                }`}
              >
                {zone}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-[#0f1522] p-1 rounded-lg border border-[#1e2d45] text-xs">
            {(['all', 'issues', 'up'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-0.5 rounded capitalize text-[11px] font-medium transition ${
                  statusFilter === st
                    ? 'bg-emerald-600 text-white'
                    : 'text-[#8892a4] hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Poll Trigger */}
          <button
            onClick={() => triggerPollAll()}
            disabled={isPolling}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#1a2438] hover:bg-[#202d46] text-white border border-[#2a3a52] rounded-lg text-xs font-semibold transition shrink-0"
            title="Poll all devices now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Poll Fleet</span>
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-[#0f1522] p-1 rounded-lg border border-[#1e2d45]">
            <button
              onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(1))))}
              className="p-1 text-[#8892a4] hover:text-white transition"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-[#8892a4] px-1 w-9 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(1))))}
              className="p-1 text-[#8892a4] hover:text-white transition"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1 text-[#8892a4] hover:text-white transition"
              title="Reset zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div
        ref={containerRef}
        className="bg-[#080d17] border border-[#1e2d45] rounded-2xl p-4 sm:p-6 min-h-[640px] overflow-auto relative shadow-2xl"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(30, 45, 69, 0.25) 1px, transparent 1px),
            linear-gradient(to right, rgba(30, 45, 69, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(30, 45, 69, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      >
        {/* Floating Canvas Top Legend */}
        <div className="absolute top-4 left-4 z-20 bg-[#0f1522]/95 backdrop-blur border border-[#1e2d45] rounded-xl p-3 text-[11px] space-y-2 shadow-xl">
          <div className="font-bold text-white text-xs flex items-center justify-between gap-4 pb-1 border-b border-[#1e2d45]">
            <span>Link Telemetry Stream</span>
            <span className="text-[10px] font-mono text-emerald-400">ONLINE</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 status-pulse-green" />
              <span className="text-[#e2e8f0]">UP (Running Stream)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 status-pulse-red" />
              <span className="text-[#e2e8f0]">DOWN (Halted/Broken)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 status-pulse-amber" />
              <span className="text-[#e2e8f0]">WARN (Degraded RTT)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <span className="text-[#e2e8f0]">RCA (Suppressed Tree)</span>
            </div>
          </div>
        </div>

        {/* Selected Node Quick Action Floater */}
        {selectedDevice && (
          <div className="absolute top-4 right-4 z-20 bg-[#0f1522]/95 backdrop-blur border border-[#2a3a52] rounded-xl p-3.5 text-xs text-white max-w-sm shadow-2xl space-y-2">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#1e2d45]">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="font-bold truncate">{selectedDevice.name}</span>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-[#8892a4] hover:text-white text-xs px-1.5 py-0.5 rounded bg-[#151d2e]"
              >
                ✕
              </button>
            </div>
            <div className="text-[11px] font-mono text-[#8892a4] space-y-0.5">
              <div>IP: <span className="text-white">{selectedDevice.ip}</span></div>
              <div>Brand: <span className="text-white capitalize">{selectedDevice.brand}</span> • Zone: <span className="text-emerald-400 uppercase">{selectedDevice.zone}</span></div>
              <div>Uplink: <span className="text-blue-400">{selectedDevice.upstream_id || 'Root Gateway'}</span></div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => onSelectDevice(selectedDevice)}
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs transition text-center"
              >
                Inspect Telemetry
              </button>
            </div>
          </div>
        )}

        {/* Scaled Topology Wrapper */}
        <div
          ref={canvasContentRef}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
          }}
          className="relative transition-transform duration-100 max-w-6xl mx-auto pt-16 pb-20"
        >
          {/* SVG Exact Real-Time Link Overlay with Animated Running Lights */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
            style={{ width: '100%', height: '100%' }}
          >
            <defs>
              {/* Glow filter for active photon packets */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Downlink Gradients */}
              <linearGradient id="grad-green" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00e5a0" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="grad-red" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.4" />
              </linearGradient>
              <linearGradient id="grad-amber" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="grad-purple" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#6b21a8" stopOpacity="0.5" />
              </linearGradient>
            </defs>

            {/* Render Link Lines connecting each child to its parent */}
            {links.map((link) => {
              const fromCoord = nodeCoords.get(link.from.id);
              const toCoord = nodeCoords.get(link.to.id);

              if (!fromCoord || !toCoord) return null;

              const parentPoll = latestPolls[link.from.id];
              const childPoll = latestPolls[link.to.id];
              const parentStatus = parentPoll?.status || 'unknown';
              const childStatus = childPoll?.status || 'unknown';

              // Determine overall link condition
              const isBroken = parentStatus === 'down' || childStatus === 'down';
              const isDegraded = parentStatus === 'degraded' || childStatus === 'degraded';
              const isAffected = childStatus === 'affected';

              let linkColor = '#00e5a0';
              let gradId = 'url(#grad-green)';
              let flowClass = 'animate-topology-flow';

              if (isBroken) {
                linkColor = '#ef4444';
                gradId = 'url(#grad-red)';
                flowClass = '';
              } else if (isDegraded) {
                linkColor = '#f59e0b';
                gradId = 'url(#grad-amber)';
                flowClass = 'animate-topology-flow-slow';
              } else if (isAffected) {
                linkColor = '#a855f7';
                gradId = 'url(#grad-purple)';
                flowClass = 'animate-topology-flow-slow';
              }

              const isPathActive =
                activePathNodeIds.has(link.from.id) && activePathNodeIds.has(link.to.id);

              // Bezier curve calculations
              const startX = fromCoord.bottomX;
              const startY = fromCoord.bottomY;
              const endX = toCoord.topX;
              const endY = toCoord.topY;

              const deltaY = endY - startY;
              const cp1Y = startY + deltaY * 0.45;
              const cp2Y = startY + deltaY * 0.55;
              const pathD = `M ${startX} ${startY} C ${startX} ${cp1Y}, ${endX} ${cp2Y}, ${endX} ${endY}`;
              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;

              return (
                <g key={link.id} className="transition-all duration-200">
                  {/* 1. Underlying ambient background conduit */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#141d2e"
                    strokeWidth={isPathActive ? 7 : 4}
                    strokeLinecap="round"
                  />

                  {/* 2. Base Glow Wire */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={gradId}
                    strokeWidth={isPathActive ? 3.5 : isBroken ? 2 : 2.5}
                    strokeOpacity={isPathActive ? 1 : isBroken ? 0.4 : 0.75}
                    strokeLinecap="round"
                  />

                  {/* 3. Real-Time Running Light Beam (Dashed flow) */}
                  {!isBroken && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke={linkColor}
                      strokeWidth={isPathActive ? 3.5 : 2.5}
                      className={flowClass}
                      strokeLinecap="round"
                      style={{
                        filter: 'drop-shadow(0 0 6px ' + linkColor + ')',
                      }}
                    />
                  )}

                  {/* 4. Moving Photon Packet Indicator */}
                  {!isBroken && (
                    <circle r={isPathActive ? 4.5 : 3.5} fill={linkColor} filter="url(#glow)">
                      <animateMotion
                        path={pathD}
                        dur={isDegraded ? '3.5s' : isPathActive ? '1.2s' : '2s'}
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* 5. Midpoint Micro Link Telemetry Tag */}
                  <g transform={`translate(${midX}, ${midY})`} className="pointer-events-auto cursor-pointer">
                    <rect
                      x="-22"
                      y="-8"
                      width="44"
                      height="16"
                      rx="8"
                      fill="#0b101b"
                      stroke={linkColor}
                      strokeWidth="1"
                      className="transition hover:scale-110"
                    />
                    <text
                      x="0"
                      y="3.5"
                      fill={linkColor}
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {isBroken ? 'FAIL' : `${childPoll?.latency_ms || 1}ms`}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Hierarchical Tiered Tree Nodes */}
          <div className="space-y-16 relative z-10">
            {/* TIER 0: Core Gateway */}
            <div className="space-y-3 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#151d2e] border border-[#1e2d45] text-[10px] uppercase font-mono tracking-widest text-[#8892a4]">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tier 0 — Core Gateway & WAN Uplink Backbone</span>
              </div>
              <div className="flex justify-center gap-6">
                {tiers[0]?.map((device) => {
                  const poll = latestPolls[device.id];
                  const status = poll?.status || 'unknown';
                  const style = getNodeColor(status);
                  const Icon = getNodeIcon(device.type);
                  const isDimmed =
                    (highlightZone !== 'all' && device.zone !== highlightZone) ||
                    (statusFilter === 'issues' && status === 'up') ||
                    (statusFilter === 'up' && status !== 'up') ||
                    (searchQuery &&
                      !device.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                      !device.ip.includes(searchQuery));
                  const isSelected = selectedNodeId === device.id;
                  const isPathHighlighted = activePathNodeIds.has(device.id);

                  return (
                    <div
                      key={device.id}
                      ref={(el) => {
                        if (el) nodeRefs.current.set(device.id, el);
                        else nodeRefs.current.delete(device.id);
                      }}
                      onClick={() => {
                        setSelectedNodeId(device.id);
                        onSelectDevice(device);
                      }}
                      onMouseEnter={() => setHoveredNodeId(device.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      className={`p-3.5 rounded-2xl border ${style.border} ${style.bg} cursor-pointer transition-all duration-200 hover:scale-105 shadow-xl min-w-[210px] text-center relative ${
                        isDimmed ? 'opacity-25' : 'opacity-100'
                      } ${
                        isSelected || isPathHighlighted
                          ? 'ring-2 ring-emerald-400 shadow-[0_0_25px_rgba(0,229,160,0.3)]'
                          : ''
                      }`}
                    >
                      {/* Top Node Anchor */}
                      <div className="w-10 h-10 mx-auto rounded-xl bg-[#0f1522] border border-[#1e2d45] flex items-center justify-center text-white mb-2 shadow-inner">
                        <Icon className={`w-5 h-5 ${style.text}`} />
                      </div>
                      <div className="font-bold text-xs text-white truncate">{device.name}</div>
                      <div className="text-[10px] font-mono text-[#8892a4] mt-0.5">{device.ip}</div>
                      <div className="mt-1.5 flex items-center justify-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                        <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">
                          {status === 'down' ? 'OFFLINE' : `${poll?.latency_ms || 1}ms`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TIER 1: Core Distribution Switching */}
            <div className="space-y-3 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#151d2e] border border-[#1e2d45] text-[10px] uppercase font-mono tracking-widest text-[#8892a4]">
                <Server className="w-3.5 h-3.5 text-blue-400" />
                <span>Tier 1 — Core 10G Distribution Switching Aggregation</span>
              </div>
              <div className="flex justify-center gap-6">
                {tiers[1]?.map((device) => {
                  const poll = latestPolls[device.id];
                  const status = poll?.status || 'unknown';
                  const style = getNodeColor(status);
                  const Icon = getNodeIcon(device.type);
                  const isDimmed =
                    (highlightZone !== 'all' && device.zone !== highlightZone) ||
                    (statusFilter === 'issues' && status === 'up') ||
                    (statusFilter === 'up' && status !== 'up') ||
                    (searchQuery &&
                      !device.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                      !device.ip.includes(searchQuery));
                  const isSelected = selectedNodeId === device.id;
                  const isPathHighlighted = activePathNodeIds.has(device.id);

                  return (
                    <div
                      key={device.id}
                      ref={(el) => {
                        if (el) nodeRefs.current.set(device.id, el);
                        else nodeRefs.current.delete(device.id);
                      }}
                      onClick={() => {
                        setSelectedNodeId(device.id);
                        onSelectDevice(device);
                      }}
                      onMouseEnter={() => setHoveredNodeId(device.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      className={`p-3 rounded-2xl border ${style.border} ${style.bg} cursor-pointer transition-all duration-200 hover:scale-105 shadow-xl min-w-[200px] text-center relative ${
                        isDimmed ? 'opacity-25' : 'opacity-100'
                      } ${
                        isSelected || isPathHighlighted
                          ? 'ring-2 ring-blue-400 shadow-[0_0_25px_rgba(59,130,246,0.3)]'
                          : ''
                      }`}
                    >
                      <div className="w-9 h-9 mx-auto rounded-xl bg-[#0f1522] border border-[#1e2d45] flex items-center justify-center text-white mb-2 shadow-inner">
                        <Icon className={`w-4 h-4 ${style.text}`} />
                      </div>
                      <div className="font-bold text-xs text-white truncate">{device.name}</div>
                      <div className="text-[10px] font-mono text-[#8892a4] mt-0.5">{device.ip}</div>
                      <div className="mt-1 flex items-center justify-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">
                          {status === 'down' ? 'OFFLINE' : `${poll?.latency_ms || 1}ms`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TIER 2: Access & PoE Switches */}
            <div className="space-y-3 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#151d2e] border border-[#1e2d45] text-[10px] uppercase font-mono tracking-widest text-[#8892a4]">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tier 2 —  & Facility PoE Access Layer / Storage</span>
              </div>
              <div className="flex flex-wrap justify-center gap-4">
                {tiers[2]?.map((device) => {
                  const poll = latestPolls[device.id];
                  const status = poll?.status || 'unknown';
                  const style = getNodeColor(status);
                  const Icon = getNodeIcon(device.type);
                  const isDimmed =
                    (highlightZone !== 'all' && device.zone !== highlightZone) ||
                    (statusFilter === 'issues' && status === 'up') ||
                    (statusFilter === 'up' && status !== 'up') ||
                    (searchQuery &&
                      !device.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                      !device.ip.includes(searchQuery));
                  const isSelected = selectedNodeId === device.id;
                  const isPathHighlighted = activePathNodeIds.has(device.id);

                  return (
                    <div
                      key={device.id}
                      ref={(el) => {
                        if (el) nodeRefs.current.set(device.id, el);
                        else nodeRefs.current.delete(device.id);
                      }}
                      onClick={() => {
                        setSelectedNodeId(device.id);
                        onSelectDevice(device);
                      }}
                      onMouseEnter={() => setHoveredNodeId(device.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      className={`p-2.5 rounded-xl border ${style.border} ${style.bg} cursor-pointer transition-all duration-200 hover:scale-105 shadow-lg min-w-[170px] max-w-[190px] text-center relative ${
                        isDimmed ? 'opacity-25' : 'opacity-100'
                      } ${
                        isSelected || isPathHighlighted
                          ? 'ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                          : ''
                      }`}
                    >
                      <div className="w-8 h-8 mx-auto rounded-lg bg-[#0f1522] border border-[#1e2d45] flex items-center justify-center text-white mb-1.5 shadow-inner">
                        <Icon className={`w-4 h-4 ${style.text}`} />
                      </div>
                      <div className="font-bold text-xs text-white truncate">{device.name}</div>
                      <div className="text-[10px] font-mono text-[#8892a4] truncate">{device.ip}</div>
                      <div className="mt-1 flex items-center justify-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        <span className="text-[10px] font-mono text-emerald-400">
                          {status === 'down' ? 'OFFLINE' : `${poll?.latency_ms || 1}ms`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TIER 3: Edge Access Points, CCTV & Gateways */}
            <div className="space-y-3 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#151d2e] border border-[#1e2d45] text-[10px] uppercase font-mono tracking-widest text-[#8892a4]">
                <Wifi className="w-3.5 h-3.5 text-purple-400" />
                <span>Tier 3 — Edge Access Points, IP Cameras & IoT Nodes</span>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {tiers[3]?.map((device) => {
                  const poll = latestPolls[device.id];
                  const status = poll?.status || 'unknown';
                  const style = getNodeColor(status);
                  const Icon = getNodeIcon(device.type);
                  const isDimmed =
                    (highlightZone !== 'all' && device.zone !== highlightZone) ||
                    (statusFilter === 'issues' && status === 'up') ||
                    (statusFilter === 'up' && status !== 'up') ||
                    (searchQuery &&
                      !device.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                      !device.ip.includes(searchQuery));
                  const isSelected = selectedNodeId === device.id;
                  const isPathHighlighted = activePathNodeIds.has(device.id);

                  return (
                    <div
                      key={device.id}
                      ref={(el) => {
                        if (el) nodeRefs.current.set(device.id, el);
                        else nodeRefs.current.delete(device.id);
                      }}
                      onClick={() => {
                        setSelectedNodeId(device.id);
                        onSelectDevice(device);
                      }}
                      onMouseEnter={() => setHoveredNodeId(device.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      className={`p-2 rounded-xl border ${style.border} ${style.bg} cursor-pointer transition-all duration-200 hover:scale-105 shadow min-w-[140px] max-w-[165px] text-center relative ${
                        isDimmed ? 'opacity-25' : 'opacity-100'
                      } ${
                        isSelected || isPathHighlighted
                          ? 'ring-2 ring-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Icon className={`w-3.5 h-3.5 ${style.text}`} />
                        <span className="font-semibold text-[11px] text-white truncate max-w-[110px]">
                          {device.name}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-[#8892a4] truncate">{device.ip}</div>
                      <div className="text-[9px] text-[#8892a4] truncate mt-0.5">{device.location}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
