import { APP_CONFIG } from '../config';
import { db } from '../db';
import { events } from '../events';
import { AnomalyEngine } from '../analysis/anomalyEngine';
import { RCAEngine } from '../analysis/rcaEngine';
import { Device, PollResult, Alert, DeviceStatus } from '../../src/types/netops';

class PollerManager {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();

  public startAll() {
    this.stopAll();
    for (const dev of db.devices.values()) {
      if (dev.enabled) {
        this.scheduleDevice(dev);
      }
    }
    console.log(`[PollerManager] Started poller for ${this.intervals.size} devices`);
  }

  public stopAll() {
    for (const timer of this.intervals.values()) {
      clearInterval(timer);
    }
    this.intervals.clear();
  }

  public scheduleDevice(device: Device) {
    if (this.intervals.has(device.id)) {
      clearInterval(this.intervals.get(device.id)!);
    }

    const intervalSec =
      device.pollInterval ||
      (device.protocol === 'icmp'
        ? APP_CONFIG.POLL_INTERVAL_ICMP
        : device.protocol === 'snmp'
        ? APP_CONFIG.POLL_INTERVAL_SNMP
        : device.protocol === 'routeros'
        ? APP_CONFIG.POLL_INTERVAL_ROUTEROS
        : APP_CONFIG.POLL_INTERVAL_SSH);

    // Initial immediate poll
    this.executePoll(device);

    // Periodic poll
    const timer = setInterval(() => {
      const current = db.devices.get(device.id);
      if (current && current.enabled) {
        this.executePoll(current);
      }
    }, intervalSec * 1000);

    this.intervals.set(device.id, timer);
  }

  public async executePoll(device: Device): Promise<PollResult> {
    const isSimFailure = db.simFailures.has(device.id);
    const prevPoll = db.latestPoll.get(device.id);

    let failures = this.consecutiveFailures.get(device.id) || 0;

    let pollResult: PollResult;

    if (isSimFailure) {
      failures += 1;
      this.consecutiveFailures.set(device.id, failures);

      const status: DeviceStatus =
        failures >= APP_CONFIG.FAILURE_THRESHOLD ? 'down' : 'degraded';

      pollResult = {
        device_id: device.id,
        timestamp: Date.now(),
        status,
        latency_ms: 0,
        packet_loss: 100,
        cpu_pct: 0,
        mem_pct: 0,
        uptime_sec: 0,
        consecutive_failures: failures,
        iface_data: [],
        raw: { error: 'Host unreachable (ICMP Request Timeout)' },
      };
    } else {
      failures = 0;
      this.consecutiveFailures.set(device.id, 0);

      // Check if upstream parent is down to tag as 'affected'
      const { rootCauseDevice, isIndirectFailure } = RCAEngine.findRootCauseForDevice(device.id);

      let status: DeviceStatus = 'up';
      let affectedBy: string | null = null;

      if (isIndirectFailure) {
        status = 'affected';
        affectedBy = rootCauseDevice.id;
      }

      // Generate realistic metrics based on device type & brand
      const baseLatency =
        device.type === 'router'
          ? 1.2
          : device.type === 'switch'
          ? 2.1
          : device.type === 'ap'
          ? 4.5
          : device.type === 'camera'
          ? 3.8
          : 5.0;
      
      const jitter = (Math.random() - 0.5) * 1.2;
      const latency = Math.max(0.5, Math.round((baseLatency + jitter) * 10) / 10);

      const cpuBase =
        device.type === 'router'
          ? 28
          : device.type === 'switch'
          ? 18
          : device.type === 'nas'
          ? 35
          : 12;
      const cpu = Math.min(100, Math.max(5, Math.round(cpuBase + (Math.random() - 0.4) * 15)));

      const memBase = device.type === 'router' ? 45 : device.type === 'nas' ? 62 : 30;
      const mem = Math.min(100, Math.max(10, Math.round(memBase + (Math.random() - 0.5) * 8)));

      const uptimeBase = (prevPoll?.uptime_sec || 86400 * 14) + (device.pollInterval || 30);

      const rxBase =
        device.type === 'router'
          ? 350_000_000
          : device.type === 'switch'
          ? 120_000_000
          : device.type === 'ap'
          ? 45_000_000
          : 12_000_000;
      const rxVariance = 1 + (Math.random() - 0.5) * 0.3;
      const txVariance = 1 + (Math.random() - 0.5) * 0.3;

      pollResult = {
        device_id: device.id,
        timestamp: Date.now(),
        status,
        latency_ms: latency,
        packet_loss: 0,
        cpu_pct: cpu,
        mem_pct: mem,
        uptime_sec: uptimeBase,
        consecutive_failures: 0,
        affected_by_upstream: affectedBy,
        iface_data: [
          {
            name: device.type === 'router' ? 'sfp-sfpplus1 (WAN1)' : 'eth0 (Trunk)',
            rx_bps: Math.round(rxBase * rxVariance),
            tx_bps: Math.round((rxBase * 0.4) * txVariance),
            status: 'up',
          },
          {
            name: device.type === 'router' ? 'sfp-sfpplus3 (LAN-10G)' : 'eth1 (PoE-Uplink)',
            rx_bps: Math.round(rxBase * 0.8 * rxVariance),
            tx_bps: Math.round(rxBase * 0.7 * txVariance),
            status: 'up',
          },
        ],
        raw: {
          protocol: device.protocol,
          responded_in_ms: latency,
          snmp_sysDescr: `${device.brand.toUpperCase()} OS v7.14 [${device.model || device.type}]`,
        },
      };
    }

    // 1. Store in DB
    db.latestPoll.set(device.id, pollResult);
    const history = db.pollHistory.get(device.id) || [];
    history.push(pollResult);
    if (history.length > APP_CONFIG.MAX_HISTORY_PER_DEVICE) {
      history.shift();
    }
    db.pollHistory.set(device.id, history);

    // 2. Anomaly Detection
    const anomalies = AnomalyEngine.evaluatePoll(pollResult);
    for (const anom of anomalies) {
      const existingAlert = db.alerts.find(
        (a) =>
          a.device_id === device.id &&
          a.type === 'anomaly' &&
          !a.resolved_at &&
          a.message.includes(anom.metric)
      );

      if (!existingAlert) {
        const newAlert: Alert = {
          id: `alert-anom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          device_id: device.id,
          device_name: device.name,
          device_ip: device.ip,
          type: 'anomaly',
          message: `[${device.name}] ${anom.threshold_rule}`,
          severity: anom.severity,
          acknowledged: false,
          created_at: Date.now(),
        };
        db.alerts.unshift(newAlert);
        db.saveAlerts();
        events.broadcast('alert:new', newAlert);
      }
    }

    // 3. State Change Management (Up <-> Down / Degraded / Affected)
    const prevStatus = prevPoll?.status || 'unknown';
    if (pollResult.status !== prevStatus && prevStatus !== 'unknown') {
      if (pollResult.status === 'down') {
        const { rootCauseDevice, isIndirectFailure } = RCAEngine.findRootCauseForDevice(device.id);

        if (!isIndirectFailure) {
          const newAlert: Alert = {
            id: `alert-down-${Date.now()}-${device.id}`,
            device_id: device.id,
            device_name: device.name,
            device_ip: device.ip,
            type: 'down',
            message: `CRITICAL: ${device.name} (${device.ip}) is DOWN (3 consecutive poll failures)`,
            severity: 'critical',
            acknowledged: false,
            created_at: Date.now(),
            root_cause_device_id: device.id,
          };
          db.alerts.unshift(newAlert);
          db.saveAlerts();
          events.broadcast('alert:new', newAlert);
        }
      } else if (pollResult.status === 'up' && prevStatus === 'down') {
        // Resolve active alerts
        const activeAlert = db.alerts.find(
          (a) => a.device_id === device.id && a.type === 'down' && !a.resolved_at
        );
        if (activeAlert) {
          activeAlert.resolved_at = Date.now();
          db.saveAlerts();
          events.broadcast('alert:resolved', {
            alert_id: activeAlert.id,
            device_id: device.id,
          });
        }
      }
    }

    // 4. Broadcast live poll update
    events.broadcast('poll:update', pollResult);

    return pollResult;
  }
}

export const pollerManager = new PollerManager();
