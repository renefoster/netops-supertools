import { db } from '../db';
import { Device, DeviceStatus, RCAResult } from '../../src/types/netops';

export class RCAEngine {
  /**
   * Builds the downstream dependency tree for a given device using iterative BFS
   */
  public static getDownstreamDevices(rootId: string): Device[] {
    const affected: Device[] = [];
    const queue: string[] = [rootId];
    const visited = new Set<string>([rootId]);

    const allDevices = Array.from(db.devices.values());

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      
      // Find all devices where upstream_id === currentId
      const directChildren = allDevices.filter(
        (d) => d.upstream_id === currentId && !visited.has(d.id)
      );

      for (const child of directChildren) {
        visited.add(child.id);
        affected.push(child);
        queue.push(child.id);
      }
    }

    return affected;
  }

  /**
   * Finds the ultimate upstream root cause for a degraded or down device
   */
  public static findRootCauseForDevice(deviceId: string): {
    rootCauseDevice: Device;
    isIndirectFailure: boolean;
  } {
    let current = db.devices.get(deviceId);
    if (!current) {
      throw new Error(`Device ${deviceId} not found`);
    }

    let rootCause = current;
    let isIndirect = false;

    const visited = new Set<string>([deviceId]);

    // Walk up the upstream_id chain iteratively
    while (current.upstream_id) {
      const parentId = current.upstream_id;
      if (visited.has(parentId)) break; // cycle prevention
      visited.add(parentId);

      const parent = db.devices.get(parentId);
      if (!parent) break;

      const parentPoll = db.latestPoll.get(parentId);
      const isParentSimFailed = db.simFailures.has(parentId);
      const isParentDown =
        isParentSimFailed ||
        (parentPoll && (parentPoll.status === 'down' || (parentPoll.consecutive_failures || 0) >= 3));

      if (isParentDown) {
        rootCause = parent;
        isIndirect = true;
      }

      current = parent;
    }

    return { rootCauseDevice: rootCause, isIndirectFailure: isIndirect };
  }

  /**
   * Performs an end-to-end RCA analysis across the entire network topology
   */
  public static evaluateAllActiveIncidents(): RCAResult[] {
    const results: RCAResult[] = [];
    const evaluatedRootCauses = new Set<string>();

    const allDevices = Array.from(db.devices.values());

    for (const dev of allDevices) {
      const poll = db.latestPoll.get(dev.id);
      const isSimFailed = db.simFailures.has(dev.id);
      const isDown = isSimFailed || (poll && poll.status === 'down');

      if (!isDown) continue;

      const { rootCauseDevice, isIndirectFailure } = this.findRootCauseForDevice(dev.id);

      if (evaluatedRootCauses.has(rootCauseDevice.id)) continue;
      evaluatedRootCauses.add(rootCauseDevice.id);

      const downstream = this.getDownstreamDevices(rootCauseDevice.id);
      const affectedIds = downstream.map((d) => d.id);

      let recommendation = '';
      if (rootCauseDevice.type === 'router') {
        recommendation = 'Check primary WAN Fiber link SFP port, Starlink backup failover state, or AC power feed in Main Server Room.';
      } else if (rootCauseDevice.type === 'switch') {
        recommendation = `Inspect 10G trunk uplink to ${rootCauseDevice.name} or PoE power supply breaker in ${rootCauseDevice.location}.`;
      } else {
        recommendation = `Power cycle ${rootCauseDevice.name} at ${rootCauseDevice.location} and verify network patch cable.`;
      }

      results.push({
        root_cause_device_id: rootCauseDevice.id,
        root_cause_name: rootCauseDevice.name,
        root_cause_ip: rootCauseDevice.ip,
        status: 'down',
        affected_devices_count: affectedIds.length,
        affected_device_ids: affectedIds,
        impact_summary:
          affectedIds.length > 0
            ? `Critical Outage: ${rootCauseDevice.name} failure is cascading to ${affectedIds.length} downstream devices (${downstream.map((d) => d.name).slice(0, 3).join(', ')}${affectedIds.length > 3 ? ` +${affectedIds.length - 3} more` : ''}).`
            : `Isolated Outage: ${rootCauseDevice.name} (${rootCauseDevice.ip}) is offline, no downstream devices affected.`,
        recommendation,
        timestamp: Date.now(),
      });
    }

    return results;
  }
}
