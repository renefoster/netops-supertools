import fs from 'fs';
import path from 'path';
import { INITIAL_DEVICES } from './config';
import {
  Device,
  PollResult,
  Alert,
  DiscoveryScanSession,
  DeviceBackup,
  BackupSchedule,
} from '../src/types/netops';

const DATA_DIR = path.join(process.cwd(), 'data');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const BACKUPS_FILE = path.join(DATA_DIR, 'backups.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class NetOpsDatabase {
  public devices: Map<string, Device> = new Map();
  public pollHistory: Map<string, PollResult[]> = new Map(); // device_id -> history
  public latestPoll: Map<string, PollResult> = new Map();
  public alerts: Alert[] = [];
  public discoverySessions: Map<string, DiscoveryScanSession> = new Map();
  public backups: DeviceBackup[] = [];
  public schedules: BackupSchedule[] = [];
  public simFailures: Set<string> = new Set(); // For IT officer outage testing

  constructor() {
    this.loadInitialData();
  }

  private loadInitialData() {
    const isSeedDisabled = process.env.SEED_DEMO_DATA === 'false' || process.env.SEED_DEMO_DATA === '0';

    if (isSeedDisabled) {
      if (fs.existsSync(DEVICES_FILE)) {
        try {
          const raw = fs.readFileSync(DEVICES_FILE, 'utf-8');
          const list: Device[] = JSON.parse(raw);
          // Filter out demo devices (keep custom user devices if any)
          const userDevices = list.filter((d) => !d.id.startsWith('dev-core-') && !d.id.startsWith('dev-dist-') && !d.id.startsWith('dev-access-') && !d.id.startsWith('dev-cam-') && !d.id.startsWith('dev-ap-') && !d.id.startsWith('dev-nas-') && !d.id.startsWith('dev-guest-') && !d.id.startsWith('dev-iot-') && !d.id.startsWith('dev-cctv-') && !d.id.startsWith('dev-tplink-') && !d.id.startsWith('dev-starlink-'));
          userDevices.forEach((d) => this.devices.set(d.id, d));
        } catch {
          this.devices.clear();
        }
      } else {
        this.devices.clear();
      }
      this.saveDevices();

      if (fs.existsSync(ALERTS_FILE)) {
        try {
          const raw = fs.readFileSync(ALERTS_FILE, 'utf-8');
          this.alerts = JSON.parse(raw);
        } catch {
          this.alerts = [];
        }
      } else {
        this.alerts = [];
        this.saveAlerts();
      }

      if (fs.existsSync(BACKUPS_FILE)) {
        try {
          const raw = fs.readFileSync(BACKUPS_FILE, 'utf-8');
          this.backups = JSON.parse(raw);
        } catch {
          this.backups = [];
        }
      } else {
        this.backups = [];
        this.saveBackups();
      }

      this.schedules = [];
      return;
    }

    // Load devices
    if (fs.existsSync(DEVICES_FILE)) {
      try {
        const raw = fs.readFileSync(DEVICES_FILE, 'utf-8');
        const list: Device[] = JSON.parse(raw);
        list.forEach((d) => this.devices.set(d.id, d));
      } catch {
        this.seedDevices();
      }
    } else {
      this.seedDevices();
    }

    // Load alerts
    if (fs.existsSync(ALERTS_FILE)) {
      try {
        const raw = fs.readFileSync(ALERTS_FILE, 'utf-8');
        this.alerts = JSON.parse(raw);
      } catch {
        this.alerts = [];
      }
    }

    // Load backups
    if (fs.existsSync(BACKUPS_FILE)) {
      try {
        const raw = fs.readFileSync(BACKUPS_FILE, 'utf-8');
        this.backups = JSON.parse(raw);
      } catch {
        this.seedBackups();
      }
    } else {
      this.seedBackups();
    }

    // Seed default schedules
    this.schedules = [
      {
        id: 'sched-core-nightly',
        name: 'Nightly Core Infrastructure Config Backup',
        cron: '0 2 * * *',
        target_zone: 'core',
        enabled: true,
        last_run: Date.now() - 3600000 * 18,
        next_run: Date.now() + 3600000 * 6,
      },
      {
        id: 'sched-switches-weekly',
        name: 'Weekly Access Switches Snapshot',
        cron: '0 3 * * 0',
        target_zone: 'access',
        enabled: true,
        last_run: Date.now() - 86400000 * 3,
        next_run: Date.now() + 86400000 * 4,
      },
    ];
  }

  private seedDevices() {
    if (process.env.SEED_DEMO_DATA === 'false') {
      this.devices.clear();
      this.saveDevices();
      return;
    }
    INITIAL_DEVICES.forEach((d) => this.devices.set(d.id, d as Device));
    this.saveDevices();
  }

  private seedBackups() {
    if (process.env.SEED_DEMO_DATA === 'false') {
      this.backups = [];
      this.saveBackups();
      return;
    }
    this.backups = [
      {
        id: 'bk-ccr2004-01',
        device_id: 'dev-core-router-01',
        device_name: 'CCR2004-Core-Router',
        filename: 'CCR2004-Core-Router_2026-08-15.rsc',
        backup_type: 'automated',
        version: 1,
        created_at: Date.now() - 86400000 * 3,
        size_bytes: 42350,
        content: `# MikroTik RouterOS Configuration Export
# Model: CCR2004-1G-12S+2XS
# Exported by  NetOps Automated Engine
/interface bridge
add name=bridge-vlan-trunk vlan-filtering=yes
/interface ethernet
set [ find default-name=sfp-sfpplus1 ] name=sfp-plus1-WAN1-Fiber comment="Primary 1Gbps Leased Line"
set [ find default-name=sfp-sfpplus2 ] name=sfp-plus2-WAN2-Starlink comment="Backup Starlink High-Performance"
set [ find default-name=sfp-sfpplus3 ] name=sfp-plus3-CoreDistribution-10G
/interface vlan
add interface=bridge-vlan-trunk name=vlan10-mgmt vlan-id=10
add interface=bridge-vlan-trunk name=vlan20-guest vlan-id=20
add interface=bridge-vlan-trunk name=vlan30-cctv vlan-id=30
add interface=bridge-vlan-trunk name=vlan40-iot vlan-id=40
/ip pool
add name=pool-guest ranges=10.20.0.10-10.20.0.250
add name=pool-mgmt ranges=192.168.1.100-192.168.1.200
/ip dhcp-server
add address-pool=pool-guest interface=vlan20-guest lease-time=4h name=dhcp-guest
/ip firewall nat
add action=masquerade chain=srcnat out-interface=sfp-plus1-WAN1-Fiber`,
      },
      {
        id: 'bk-cisco-dist-01',
        device_id: 'dev-dist-switch-01',
        device_name: 'Cisco-Core-Distribution-SW',
        filename: 'Cisco-Core-Distribution-SW_2026-08-16.cfg',
        backup_type: 'automated',
        version: 1,
        created_at: Date.now() - 86400000 * 2,
        size_bytes: 28400,
        content: `! Cisco IOS Software, Catalyst L3 Distribution Switch
!  Core Aggregation Layer
version 17.6
service timestamps debug datetime msec
service timestamps log datetime msec
hostname Cisco-Core-Distribution-SW
!
spanning-tree mode rapid-pvst
spanning-tree extend system-id
!
vlan 10,20,30,40,99
!
interface TenGigabitEthernet1/1/1
 description Trunk to CCR2004 Core Router
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,99
!
interface TenGigabitEthernet1/1/2
 description Trunk to SW01-PoE
 switchport mode trunk
!
interface TenGigabitEthernet1/1/3
 description Trunk to SW02-PoE
 switchport mode trunk
!
end`,
      },
    ];
    this.saveBackups();
  }

  public saveDevices() {
    try {
      const list = Array.from(this.devices.values());
      fs.writeFileSync(DEVICES_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] saveDevices error:', err);
    }
  }

  public saveAlerts() {
    try {
      fs.writeFileSync(ALERTS_FILE, JSON.stringify(this.alerts.slice(-200), null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] saveAlerts error:', err);
    }
  }

  public saveBackups() {
    try {
      fs.writeFileSync(BACKUPS_FILE, JSON.stringify(this.backups, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] saveBackups error:', err);
    }
  }
}

export const db = new NetOpsDatabase();
