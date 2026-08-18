import React, { useState, useMemo } from 'react';
import { Device, DeviceStatus } from '../../types/netops';
import { useNetOps } from '../../context/NetOpsContext';
import { Radio, ShieldAlert, Crosshair, Sparkles, Server, Wifi, Camera } from 'lucide-react';

interface LiveRadarWidgetProps {
  onSelectDevice: (device: Device) => void;
}

export const LiveRadarWidget: React.FC<LiveRadarWidgetProps> = ({ onSelectDevice }) => {
  const { devices, latestPolls, rcaResults } = useNetOps();
  const [hoveredDevice, setHoveredDevice] = useState<Device | null>(null);
  const [radarFilter, setRadarFilter] = useState<'all' | 'alert' | 'core' | 'access'>('all');

  // Compute polar coordinates (angle theta & radius r) for each device
  const deviceBlips = useMemo(() => {
    // Group devices by zone / tier to assign concentric radius
    // Radius: Core ~ 25%, Distribution ~ 48%, Access ~ 70%, CCTV/IoT/Edge ~ 88%
    const getRadiusForDevice = (dev: Device): number => {
      switch (dev.zone) {
        case 'core':
          return 26;
        case 'distribution':
          return 48;
        case 'access':
          return 70;
        case 'cctv':
        case 'iot':
          return 86;
        default:
          return 65;
      }
    };

    const count = devices.length;
    return devices.map((dev, idx) => {
      // Golden angle or evenly distributed angle
      const angleDeg = (idx * (360 / Math.max(1, count)) + (idx % 2 === 0 ? 15 : -15) + 360) % 360;
      const angleRad = (angleDeg * Math.PI) / 180;
      const radiusPercent = getRadiusForDevice(dev);

      // Convert polar to Cartesian percentage from center (50%, 50%)
      const x = 50 + (radiusPercent * Math.cos(angleRad)) / 2;
      const y = 50 + (radiusPercent * Math.sin(angleRad)) / 2;

      const poll = latestPolls[dev.id];
      const status: DeviceStatus = poll?.status || 'unknown';

      return {
        device: dev,
        x,
        y,
        angleDeg,
        radiusPercent,
        status,
        latency: poll?.latency_ms || 0,
      };
    });
  }, [devices, latestPolls]);

  const filteredBlips = deviceBlips.filter((b) => {
    if (radarFilter === 'alert') {
      return b.status === 'down' || b.status === 'degraded' || b.status === 'affected';
    }
    if (radarFilter === 'core') {
      return b.device.zone === 'core' || b.device.zone === 'distribution';
    }
    if (radarFilter === 'access') {
      return b.device.zone === 'access' || b.device.zone === 'cctv' || b.device.zone === 'iot';
    }
    return true;
  });

  const getBlipColor = (status: DeviceStatus) => {
    switch (status) {
      case 'up':
        return {
          fill: '#00e5a0',
          glow: 'rgba(0, 229, 160, 0.8)',
          ring: 'rgba(0, 229, 160, 0.3)',
          label: 'UP',
        };
      case 'down':
        return {
          fill: '#ef4444',
          glow: 'rgba(239, 68, 68, 0.9)',
          ring: 'rgba(239, 68, 68, 0.4)',
          label: 'DOWN',
        };
      case 'degraded':
        return {
          fill: '#f59e0b',
          glow: 'rgba(245, 158, 11, 0.8)',
          ring: 'rgba(245, 158, 11, 0.3)',
          label: 'WARN',
        };
      case 'affected':
        return {
          fill: '#a855f7',
          glow: 'rgba(168, 85, 247, 0.8)',
          ring: 'rgba(168, 85, 247, 0.3)',
          label: 'AFFECTED',
        };
      default:
        return {
          fill: '#8892a4',
          glow: 'rgba(136, 146, 164, 0.5)',
          ring: 'transparent',
          label: 'UNKNOWN',
        };
    }
  };

  return (
    <div className="bg-[#151d2e] border border-[#1e2d45] rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row items-center gap-6 relative overflow-hidden shadow-xl">
      {/* Radar Left/Top Screen */}
      <div className="relative w-full max-w-[320px] sm:max-w-[360px] aspect-square flex-shrink-0 flex items-center justify-center">
        {/* Radar Background Container */}
        <div className="w-full h-full rounded-full bg-[#080d17] border-2 border-[#1e2d45] relative overflow-hidden shadow-[inset_0_0_30px_rgba(0,229,160,0.08)]">
          {/* Concentric Range Rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Range 4: Edge */}
            <div className="w-[88%] h-[88%] rounded-full border border-[#1e2d45]/80" />
            {/* Range 3: Access */}
            <div className="w-[70%] h-[70%] rounded-full border border-[#1e2d45]/80" />
            {/* Range 2: Distribution */}
            <div className="w-[48%] h-[48%] rounded-full border border-emerald-500/20 border-dashed" />
            {/* Range 1: Core */}
            <div className="w-[26%] h-[26%] rounded-full border border-emerald-500/30" />
            {/* Center Core Dot */}
            <div className="w-2 h-2 rounded-full bg-emerald-400 status-pulse-green" />
          </div>

          {/* Crosshair Axes */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-[#1e2d45]/60" />
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] bg-[#1e2d45]/60" />
            {/* 45 degree diagonals */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-[#1e2d45]/25 rotate-45" />
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-[#1e2d45]/25 -rotate-45" />
          </div>

          {/* Rotating Radar Sweep Beam */}
          <div className="absolute inset-0 pointer-events-none animate-radar-sweep origin-center">
            <div
              className="w-full h-full rounded-full"
              style={{
                background:
                  'conic-gradient(from 0deg at 50% 50%, rgba(0, 229, 160, 0.35) 0deg, rgba(0, 229, 160, 0.08) 45deg, transparent 90deg, transparent 360deg)',
              }}
            />
          </div>

          {/* Radar HUD Compass Markers */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-mono text-emerald-400/70 font-semibold pointer-events-none">
            000°
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[#8892a4]/70 font-semibold pointer-events-none">
            180°
          </div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[#8892a4]/70 font-semibold pointer-events-none">
            270°
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[#8892a4]/70 font-semibold pointer-events-none">
            090°
          </div>

          {/* Live Device Blip Dots */}
          {filteredBlips.map((blip) => {
            const colors = getBlipColor(blip.status);
            const isHovered = hoveredDevice?.id === blip.device.id;

            return (
              <div
                key={blip.device.id}
                style={{
                  left: `${blip.x}%`,
                  top: `${blip.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onClick={() => onSelectDevice(blip.device)}
                onMouseEnter={() => setHoveredDevice(blip.device)}
                onMouseLeave={() => setHoveredDevice(null)}
                className="absolute z-20 cursor-pointer group"
              >
                {/* Blip Ping Halo */}
                <div
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all group-hover:scale-150"
                  style={{
                    backgroundColor: colors.ring,
                    boxShadow: `0 0 10px ${colors.glow}`,
                  }}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      blip.status === 'down'
                        ? 'status-pulse-red'
                        : blip.status === 'degraded'
                        ? 'status-pulse-amber'
                        : ''
                    }`}
                    style={{ backgroundColor: colors.fill }}
                  />
                </div>

                {/* Micro tooltip on blip hover */}
                {isHovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 bg-[#0f1522] border border-[#2a3a52] text-white px-2 py-1 rounded shadow-xl whitespace-nowrap pointer-events-none text-[10px] font-mono">
                    <div className="font-bold text-emerald-400">{blip.device.name}</div>
                    <div className="text-[#8892a4]">
                      {blip.device.ip} • {blip.latency}ms
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Radar Right Controls & Active Selected Target Display */}
      <div className="flex-1 w-full flex flex-col justify-between space-y-4">
        {/* Top Radar Bar */}
        <div>
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1e2d45]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <span>Tactical Device Radar</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 status-pulse-green" />
                </h3>
                <p className="text-[11px] text-[#8892a4]">Real-time 360° telemetry sweep & node locator</p>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-1 bg-[#0f1522] p-1 rounded-lg border border-[#1e2d45] text-[11px]">
              {(['all', 'alert', 'core', 'access'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setRadarFilter(mode)}
                  className={`px-2 py-0.5 rounded capitalize font-medium transition ${
                    radarFilter === mode
                      ? 'bg-[#1a2438] text-white border border-[#2a3a52]'
                      : 'text-[#8892a4] hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Target Insight or Hovered Node Card */}
          <div className="mt-3 bg-[#0f1522] border border-[#1e2d45] rounded-xl p-3 min-h-[96px] flex items-center justify-between">
            {hoveredDevice ? (
              <div className="flex items-center justify-between w-full">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{hoveredDevice.name}</span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#151d2e] border border-[#1e2d45] text-emerald-400">
                      {hoveredDevice.zone}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-[#8892a4] mt-0.5">
                    IP: <span className="text-white">{hoveredDevice.ip}</span> • Location:{' '}
                    <span className="text-white">{hoveredDevice.location}</span>
                  </div>
                  <div className="text-[11px] text-[#8892a4] mt-1">
                    Protocol:{' '}
                    <span className="text-blue-400 font-mono uppercase">
                      {hoveredDevice.protocol}
                    </span>{' '}
                    • Vendor: <span className="capitalize text-white">{hoveredDevice.brand}</span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectDevice(hoveredDevice)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition"
                >
                  Inspect Node
                </button>
              </div>
            ) : (
              <div className="text-xs text-[#8892a4] space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                  <span>360° Radar Scanning {devices.length} Monitored Endpoints</span>
                </div>
                <p className="text-[11px] text-[#8892a4]">
                  Hover over any glowing dot on the radar circle to preview device coordinates, latency, and status.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Ring Range Legend Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1 border-t border-[#1e2d45]/60 font-mono">
          <div className="flex items-center gap-1.5 text-[#8892a4]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[11px]">Inner: Core GW</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#8892a4]">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-[11px]">Mid-1: Distribution</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#8892a4]">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-[11px]">Mid-2: Access SW</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#8892a4]">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-[11px]">Outer: Edge APs/CCTV</span>
          </div>
        </div>
      </div>
    </div>
  );
};
