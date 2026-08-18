import { APP_CONFIG } from '../config';
import { db } from '../db';
import { AnomalyReport, PollResult } from '../../src/types/netops';

export class AnomalyEngine {
  /**
   * Evaluates incoming poll results against statistical rolling averages
   */
  public static evaluatePoll(poll: PollResult): AnomalyReport[] {
    const anomalies: AnomalyReport[] = [];
    const history = db.pollHistory.get(poll.device_id) || [];

    if (history.length < 5) {
      // Need minimum sample size to calculate statistical baseline
      return anomalies;
    }

    // 1. Latency Spike Check (> 3x baseline)
    const validLatencies = history
      .map((h) => h.latency_ms)
      .filter((l) => l > 0);
    
    if (validLatencies.length > 3) {
      const avgLatency =
        validLatencies.reduce((sum, v) => sum + v, 0) / validLatencies.length;
      
      if (
        poll.latency_ms > 15 && // Ignore trivial sub-15ms fluctuations
        poll.latency_ms > avgLatency * APP_CONFIG.ANOMALY_THRESHOLDS.LATENCY_MULTIPLIER
      ) {
        anomalies.push({
          device_id: poll.device_id,
          metric: 'latency',
          current_value: Math.round(poll.latency_ms * 10) / 10,
          baseline_value: Math.round(avgLatency * 10) / 10,
          threshold_rule: `Latency (${Math.round(poll.latency_ms)}ms) exceeds 3x baseline (${Math.round(avgLatency)}ms)`,
          severity: poll.latency_ms > 150 ? 'critical' : 'warning',
          timestamp: poll.timestamp,
        });
      }
    }

    // 2. Packet Loss Threshold (> 5%)
    if (poll.packet_loss >= APP_CONFIG.ANOMALY_THRESHOLDS.PACKET_LOSS_PCT) {
      anomalies.push({
        device_id: poll.device_id,
        metric: 'packet_loss',
        current_value: Math.round(poll.packet_loss * 10) / 10,
        baseline_value: 0,
        threshold_rule: `Packet loss (${Math.round(poll.packet_loss)}%) exceeds ${APP_CONFIG.ANOMALY_THRESHOLDS.PACKET_LOSS_PCT}% threshold`,
        severity: poll.packet_loss >= 20 ? 'critical' : 'warning',
        timestamp: poll.timestamp,
      });
    }

    // 3. CPU Spike (> 90% for 3 consecutive polls)
    if (poll.cpu_pct >= APP_CONFIG.ANOMALY_THRESHOLDS.CPU_PCT) {
      const lastThree = history.slice(-2);
      const isConsistentHigh =
        lastThree.length === 2 &&
        lastThree.every((h) => h.cpu_pct >= APP_CONFIG.ANOMALY_THRESHOLDS.CPU_PCT);

      if (isConsistentHigh) {
        anomalies.push({
          device_id: poll.device_id,
          metric: 'cpu',
          current_value: Math.round(poll.cpu_pct * 10) / 10,
          baseline_value: 45,
          threshold_rule: `CPU load sustained above 90% for ≥3 poll cycles`,
          severity: 'critical',
          timestamp: poll.timestamp,
        });
      }
    }

    // 4. Traffic Spike (> 5x baseline)
    if (poll.iface_data && poll.iface_data.length > 0) {
      const currentTotalBps = poll.iface_data.reduce(
        (sum, iface) => sum + (iface.rx_bps + iface.tx_bps),
        0
      );

      const historicalTraffic = history
        .map((h) =>
          (h.iface_data || []).reduce(
            (sum, iface) => sum + (iface.rx_bps + iface.tx_bps),
            0
          )
        )
        .filter((t) => t > 0);

      if (historicalTraffic.length > 3) {
        const avgTraffic =
          historicalTraffic.reduce((sum, v) => sum + v, 0) /
          historicalTraffic.length;

        if (
          currentTotalBps > 50_000_000 && // at least 50 Mbps
          currentTotalBps > avgTraffic * APP_CONFIG.ANOMALY_THRESHOLDS.TRAFFIC_MULTIPLIER
        ) {
          anomalies.push({
            device_id: poll.device_id,
            metric: 'traffic',
            current_value: Math.round((currentTotalBps / 1_000_000) * 10) / 10,
            baseline_value: Math.round((avgTraffic / 1_000_000) * 10) / 10,
            threshold_rule: `Interface throughput surge > 5x historical baseline (Possible broadcast storm or heavy backup)`,
            severity: 'warning',
            timestamp: poll.timestamp,
          });
        }
      }
    }

    return anomalies;
  }
}
