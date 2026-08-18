import { db } from '../db';
import { events } from '../events';
import { DiscoveryHost, DiscoveryScanSession, DeviceType, DeviceBrand, PollProtocol } from '../../src/types/netops';

const OUI_DATABASE: Record<string, { vendor: string; brand: DeviceBrand; type: DeviceType }> = {
  '48:8F:5A': { vendor: 'MikroTik', brand: 'mikrotik', type: 'router' },
  '6C:3B:6B': { vendor: 'MikroTik', brand: 'mikrotik', type: 'router' },
  'B8:69:F4': { vendor: 'MikroTik', brand: 'mikrotik', type: 'router' },
  '00:26:0B': { vendor: 'Cisco Systems', brand: 'cisco', type: 'switch' },
  '00:1E:BD': { vendor: 'Cisco Systems', brand: 'cisco', type: 'switch' },
  '74:83:C2': { vendor: 'Ubiquiti Networks', brand: 'ubiquiti', type: 'ap' },
  'F0:9F:C2': { vendor: 'Ubiquiti Networks', brand: 'ubiquiti', type: 'switch' },
  'BC:AD:28': { vendor: 'Hikvision Digital', brand: 'hikvision', type: 'camera' },
  'AC:CC:8E': { vendor: 'Dahua Technology', brand: 'dahua', type: 'camera' },
  '00:11:32': { vendor: 'Synology Inc.', brand: 'synology', type: 'nas' },
  '24:62:AB': { vendor: 'Espressif Inc.', brand: 'generic', type: 'gateway' },
  '50:C7:BF': { vendor: 'TP-Link Corporation', brand: 'tplink', type: 'switch' },
  'B4:B0:24': { vendor: 'Sonos Inc.', brand: 'generic', type: 'other' },
  '00:17:88': { vendor: 'Philips Lighting', brand: 'generic', type: 'other' },
  '3C:22:FB': { vendor: 'Apple Inc.', brand: 'generic', type: 'other' },
};

export class DiscoveryManager {
  public static generateIpsFromSubnet(cidr: string): string[] {
    const parts = cidr.trim().split('/');
    const baseIp = parts[0];
    const prefix = parseInt(parts[1] || '24', 10);

    const ipParts = baseIp.split('.').map(Number);
    if (ipParts.length !== 4 || ipParts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      throw new Error(`Invalid CIDR subnet notation: ${cidr}`);
    }

    const ips: string[] = [];

    if (prefix === 24) {
      const prefix3 = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
      for (let i = 1; i <= 254; i++) {
        ips.push(`${prefix3}.${i}`);
      }
    } else if (prefix >= 28) {
      const count = Math.pow(2, 32 - prefix) - 2;
      const start = ipParts[3] + 1;
      const prefix3 = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
      for (let i = 0; i < count; i++) {
        ips.push(`${prefix3}.${start + i}`);
      }
    } else {
      // Default to scanning first /24 chunk
      const prefix3 = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
      for (let i = 1; i <= 254; i++) {
        ips.push(`${prefix3}.${i}`);
      }
    }

    return ips;
  }

  public static resolveVendorFromMac(mac: string): {
    vendor: string;
    brand: DeviceBrand;
    type: DeviceType;
  } {
    const cleanMac = mac.toUpperCase().replace(/[-.]/g, ':');
    const prefix = cleanMac.slice(0, 8);

    if (OUI_DATABASE[prefix]) {
      return OUI_DATABASE[prefix];
    }

    return { vendor: 'Generic Network Hardware', brand: 'generic', type: 'other' };
  }

  public static async runScan(subnet: string): Promise<DiscoveryScanSession> {
    const scanId = `scan-${Date.now()}`;
    const ips = this.generateIpsFromSubnet(subnet);

    const session: DiscoveryScanSession = {
      scan_id: scanId,
      subnet,
      status: 'running',
      total_ips: ips.length,
      scanned_ips: 0,
      found_hosts: [],
      started_at: Date.now(),
    };

    db.discoverySessions.set(scanId, session);

    // Run simulated discovery scan in background batches
    this.executeScanAsync(session, ips);

    return session;
  }

  private static async executeScanAsync(
    session: DiscoveryScanSession,
    ips: string[]
  ) {
    const batchSize = 10;
    const knownDevices = Array.from(db.devices.values());

    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);

      for (const ip of batch) {
        session.scanned_ips += 1;

        // Check if matching device already exists in inventory
        const existing = knownDevices.find((d) => d.ip === ip);

        // Or randomly simulate additional unmanaged devices on subnet
        const isIpEndingFound =
          existing !== undefined ||
          ip.endsWith('.1') ||
          ip.endsWith('.2') ||
          ip.endsWith('.10') ||
          ip.endsWith('.11') ||
          ip.endsWith('.12') ||
          ip.endsWith('.15') ||
          ip.endsWith('.20') ||
          ip.endsWith('.25') ||
          ip.endsWith('.30') ||
          ip.endsWith('.45') || // Unmanaged Apple TV in Master 
          ip.endsWith('.88'); // Unmanaged Sonos Soundbar

        if (isIpEndingFound) {
          let mac = existing?.mac;
          let hostname = existing?.name;
          let vendor = existing?.vendor;
          let brand: DeviceBrand = existing?.brand || 'generic';
          let type: DeviceType = existing?.type || 'other';
          let protocol: PollProtocol = existing?.protocol || 'icmp';
          let openPorts: number[] = [80];

          if (existing) {
            openPorts =
              existing.type === 'router'
                ? [22, 80, 443, 8291, 8728, 53]
                : existing.type === 'switch'
                ? [22, 80, 161]
                : existing.type === 'camera'
                ? [80, 554, 8000]
                : existing.type === 'nas'
                ? [80, 443, 5000, 5001, 22]
                : [80, 443];
          } else if (ip.endsWith('.45')) {
            mac = '3C:22:FB:99:88:77';
            hostname = 'AppleTV-Master';
            vendor = 'Apple Inc.';
            type = 'other';
            brand = 'generic';
            openPorts = [7000, 5000, 80];
          } else if (ip.endsWith('.88')) {
            mac = 'B4:B0:24:11:33:55';
            hostname = 'Sonos-LivingRoom-Arc';
            vendor = 'Sonos Inc.';
            type = 'other';
            brand = 'generic';
            openPorts = [1400, 1443, 443];
          }

          const host: DiscoveryHost = {
            ip,
            mac,
            hostname,
            vendor,
            open_ports: openPorts,
            discovered_at: Date.now(),
            estimated_brand: brand,
            estimated_type: type,
            suggested_protocol: protocol,
          };

          session.found_hosts.push(host);
        }
      }

      // Small delay between batches to mimic real ICMP/ARP sweeps
      await new Promise((r) => setTimeout(r, 60));

      events.broadcast('discovery:progress', {
        scan_id: session.scan_id,
        scanned: session.scanned_ips,
        total: session.total_ips,
        found_count: session.found_hosts.length,
        latest_host: session.found_hosts[session.found_hosts.length - 1],
      });
    }

    session.status = 'completed';
    session.completed_at = Date.now();
    events.broadcast('discovery:complete', {
      scan_id: session.scan_id,
      total_found: session.found_hosts.length,
    });
  }
}
