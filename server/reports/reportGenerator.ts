import { db } from '../db';
import { SLAStats, NetworkHealthSummary } from '../../src/types/netops';

export class ReportGenerator {
  public static calculateSLA(timeRangeDays: number = 7): SLAStats[] {
    const cutoff = Date.now() - timeRangeDays * 86400000;
    const stats: SLAStats[] = [];

    for (const dev of db.devices.values()) {
      const history = db.pollHistory.get(dev.id) || [];
      const relevantHistory = history.filter((p) => p.timestamp >= cutoff);

      const totalPolls = relevantHistory.length || 1;
      const downPolls = relevantHistory.filter(
        (p) => p.status === 'down' || p.status === 'affected'
      ).length;

      const uptimePct = Math.round(((totalPolls - downPolls) / totalPolls) * 10000) / 100;

      const latencies = relevantHistory
        .map((p) => p.latency_ms)
        .filter((l) => l > 0);
      const avgLat =
        latencies.length > 0
          ? Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 10) / 10
          : 0;
      const maxLat = latencies.length > 0 ? Math.max(...latencies) : 0;

      const deviceAlerts = db.alerts.filter(
        (a) => a.device_id === dev.id && a.created_at >= cutoff
      );
      const totalIncidents = deviceAlerts.length;

      // Calculate total downtime in minutes
      const totalDowntimeMin = downPolls * ((dev.pollInterval || 30) / 60);
      const mttr = totalIncidents > 0 ? Math.round(totalDowntimeMin / totalIncidents) : 0;

      stats.push({
        device_id: dev.id,
        device_name: dev.name,
        uptime_pct: Math.min(100, Math.max(0, uptimePct)),
        avg_latency_ms: avgLat,
        max_latency_ms: maxLat,
        packet_loss_avg: 0,
        total_incidents: totalIncidents,
        total_downtime_min: Math.round(totalDowntimeMin),
        mttr_min: mttr,
      });
    }

    return stats;
  }

  public static getNetworkSummary(): NetworkHealthSummary {
    const devices = Array.from(db.devices.values());
    let online = 0;
    let degraded = 0;
    let down = 0;
    let affected = 0;
    let totalLat = 0;
    let latCount = 0;
    let totalRxBps = 0;
    let totalTxBps = 0;

    for (const dev of devices) {
      const isSimDown = db.simFailures.has(dev.id);
      const poll = db.latestPoll.get(dev.id);

      if (isSimDown) {
        down += 1;
      } else if (!poll) {
        online += 1;
      } else if (poll.status === 'up') {
        online += 1;
        totalLat += poll.latency_ms;
        latCount += 1;
      } else if (poll.status === 'degraded') {
        degraded += 1;
        totalLat += poll.latency_ms;
        latCount += 1;
      } else if (poll.status === 'down') {
        down += 1;
      } else if (poll.status === 'affected') {
        affected += 1;
      }

      if (poll?.iface_data) {
        for (const iface of poll.iface_data) {
          totalRxBps += iface.rx_bps;
          totalTxBps += iface.tx_bps;
        }
      }
    }

    const activeAlerts = db.alerts.filter((a) => !a.resolved_at);
    const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical');

    const totalDevs = devices.length || 1;
    const healthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(((online + degraded * 0.7) / totalDevs) * 100 - criticalAlerts.length * 5)
      )
    );

    return {
      total_devices: devices.length,
      online_count: online,
      degraded_count: degraded,
      down_count: down,
      affected_count: affected,
      active_alerts_count: activeAlerts.length,
      critical_alerts_count: criticalAlerts.length,
      avg_network_latency: latCount > 0 ? Math.round((totalLat / latCount) * 10) / 10 : 0,
      total_rx_mbps: Math.round((totalRxBps / 1_000_000) * 10) / 10,
      total_tx_mbps: Math.round((totalTxBps / 1_000_000) * 10) / 10,
      fleet_health_score: healthScore,
    };
  }
}
