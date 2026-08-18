import { db } from '../db';
import { Device, DeviceBackup } from '../../src/types/netops';

export class BackupManager {
  public static async runBackupForDevice(deviceId: string): Promise<DeviceBackup> {
    const device = db.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const previousBackups = db.backups.filter((b) => b.device_id === deviceId);
    const version = previousBackups.length + 1;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const ext =
      device.brand === 'mikrotik'
        ? 'rsc'
        : device.brand === 'cisco'
        ? 'cfg'
        : device.brand === 'ubiquiti'
        ? 'unf'
        : 'txt';

    const filename = `${device.name.replace(/[^a-zA-Z0-9-_]/g, '_')}_${dateStr}_v${version}.${ext}`;

    let configText = '';

    if (device.brand === 'mikrotik') {
      configText = `# RouterOS 7.14.3 Configuration Export
# Device: ${device.name} [${device.ip}]
# Generated: ${now.toISOString()}
/system identity set name="${device.name}"
/interface bridge add name=bridge-lan vlan-filtering=yes
/interface ethernet
set [ find default-name=ether1 ] name=ether1-LAN comment="${device.location}"
/ip address
add address=${device.ip}/24 interface=bridge-lan network=192.168.1.0
/ip firewall filter
add action=accept chain=input connection-state=established,related
add action=drop chain=input in-interface=ether1-WAN connection-state=invalid
/system clock set time-zone-name=Asia/Singapore
/system ntp client set enabled=yes servers=pool.ntp.org`;
    } else if (device.brand === 'cisco') {
      configText = `! Cisco IOS L3 Switch Configuration
! Hostname: ${device.name}
! Location: ${device.location}
! Generated: ${now.toISOString()}
version 17.6
service password-encryption
hostname ${device.name}
!
ip routing
ip domain-name .lan
!
interface Vlan1
 ip address ${device.ip} 255.255.255.0
 no shutdown
!
line vty 0 4
 transport input ssh
 login local
!
end`;
    } else {
      configText = `# Generic Network Appliance Snapshot
# Model: ${device.type.toUpperCase()} (${device.vendor || device.brand})
# Hostname: ${device.name}
# IP: ${device.ip}
# Timestamp: ${now.toISOString()}
HOSTNAME=${device.name}
IPADDR=${device.ip}
NETMASK=255.255.255.0
GATEWAY=192.168.1.1
ZONE=${device.zone}
STATUS=ACTIVE_MONITORED`;
    }

    const backup: DeviceBackup = {
      id: `bk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      device_id: device.id,
      device_name: device.name,
      filename,
      content: configText,
      backup_type: 'manual',
      version,
      created_at: Date.now(),
      size_bytes: Buffer.byteLength(configText, 'utf-8'),
    };

    db.backups.unshift(backup);
    db.saveBackups();

    return backup;
  }

  public static getBackupsForDevice(deviceId: string): DeviceBackup[] {
    return db.backups
      .filter((b) => b.device_id === deviceId)
      .sort((a, b) => b.created_at - a.created_at);
  }

  public static generateDiff(
    oldBackupId: string,
    newBackupId: string
  ): {
    old_filename: string;
    new_filename: string;
    diff_lines: Array<{
      type: 'added' | 'removed' | 'unchanged';
      content: string;
      line_old?: number;
      line_new?: number;
    }>;
  } {
    const oldB = db.backups.find((b) => b.id === oldBackupId);
    const newB = db.backups.find((b) => b.id === newBackupId);

    if (!oldB || !newB) {
      throw new Error('One or both backup files could not be found');
    }

    const oldLines = oldB.content.split('\n');
    const newLines = newB.content.split('\n');

    const diffLines: Array<{
      type: 'added' | 'removed' | 'unchanged';
      content: string;
      line_old?: number;
      line_new?: number;
    }> = [];

    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
      const lineOld = oldLines[i];
      const lineNew = newLines[i];

      if (lineOld === lineNew) {
        diffLines.push({
          type: 'unchanged',
          content: lineOld,
          line_old: i + 1,
          line_new: i + 1,
        });
      } else {
        if (lineOld !== undefined) {
          diffLines.push({
            type: 'removed',
            content: lineOld,
            line_old: i + 1,
          });
        }
        if (lineNew !== undefined) {
          diffLines.push({
            type: 'added',
            content: lineNew,
            line_new: i + 1,
          });
        }
      }
    }

    return {
      old_filename: oldB.filename,
      new_filename: newB.filename,
      diff_lines: diffLines,
    };
  }
}
