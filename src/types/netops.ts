export type DeviceType = 'router' | 'switch' | 'ap' | 'server' | 'camera' | 'gateway' | 'nas' | 'other';
export type DeviceBrand = 'mikrotik' | 'ubiquiti' | 'cisco' | 'tplink' | 'hikvision' | 'dahua' | 'synology' | 'generic';
export type PollProtocol = 'icmp' | 'snmp' | 'routeros' | 'ssh';
export type DeviceStatus = 'up' | 'down' | 'degraded' | 'affected' | 'unknown';
export type NetworkZone = 'core' | 'distribution' | 'access' | 'iot' | 'cctv' | 'guest';

export interface Device {
  id: string;
  name: string;
  ip: string;
  mac?: string;
  vendor?: string;
  type: DeviceType;
  brand: DeviceBrand;
  model?: string;
  protocol: PollProtocol;
  credentials?: {
    snmpCommunity?: string;
    snmpVersion?: 'v1' | 'v2c' | 'v3';
    sshUser?: string;
    sshPort?: number;
    routerOsPort?: number;
  };
  location: string;
  zone: NetworkZone;
  upstream_id?: string | null;
  tags?: string[];
  enabled: boolean;
  pollInterval?: number; // in seconds
  created_at: number;
  updated_at: number;
}

export interface InterfaceTraffic {
  name: string;
  rx_bps: number;
  tx_bps: number;
  status: 'up' | 'down';
  errors?: number;
}

export interface PollResult {
  id?: number;
  device_id: string;
  timestamp: number;
  status: DeviceStatus;
  latency_ms: number;
  packet_loss: number; // percentage 0-100
  cpu_pct: number;
  mem_pct: number;
  uptime_sec: number;
  consecutive_failures?: number;
  iface_data?: InterfaceTraffic[];
  raw?: Record<string, any>;
  affected_by_upstream?: string | null;
}

export interface Alert {
  id: number | string;
  device_id: string;
  device_name?: string;
  device_ip?: string;
  type: 'down' | 'degraded' | 'anomaly' | 'recovered' | 'affected';
  message: string;
  severity: 'critical' | 'warning' | 'info';
  acknowledged: boolean;
  created_at: number;
  resolved_at?: number | null;
  root_cause_device_id?: string | null;
}

export interface AnomalyReport {
  device_id: string;
  metric: 'latency' | 'packet_loss' | 'cpu' | 'traffic';
  current_value: number;
  baseline_value: number;
  threshold_rule: string;
  severity: 'warning' | 'critical';
  timestamp: number;
}

export interface RCAResult {
  root_cause_device_id: string;
  root_cause_name: string;
  root_cause_ip: string;
  status: DeviceStatus;
  affected_devices_count: number;
  affected_device_ids: string[];
  impact_summary: string;
  recommendation: string;
  timestamp: number;
}

export interface DiscoveryHost {
  ip: string;
  mac?: string;
  hostname?: string;
  vendor?: string;
  open_ports: number[];
  discovered_at: number;
  estimated_type?: DeviceType;
  estimated_brand?: DeviceBrand;
  suggested_protocol?: PollProtocol;
}

export interface DiscoveryScanSession {
  scan_id: string;
  subnet: string;
  status: 'running' | 'completed' | 'failed';
  total_ips: number;
  scanned_ips: number;
  found_hosts: DiscoveryHost[];
  started_at: number;
  completed_at?: number;
}

export interface DeviceBackup {
  id: string;
  device_id: string;
  device_name: string;
  filename: string;
  content: string;
  backup_type: 'automated' | 'manual';
  version: number;
  created_at: number;
  size_bytes: number;
}

export interface BackupSchedule {
  id: string;
  name: string;
  cron: string;
  target_zone?: string;
  enabled: boolean;
  last_run?: number;
  next_run?: number;
}

export interface SLAStats {
  device_id: string;
  device_name: string;
  uptime_pct: number;
  avg_latency_ms: number;
  max_latency_ms: number;
  packet_loss_avg: number;
  total_incidents: number;
  total_downtime_min: number;
  mttr_min: number;
}

export interface NetworkHealthSummary {
  total_devices: number;
  online_count: number;
  degraded_count: number;
  down_count: number;
  affected_count: number;
  active_alerts_count: number;
  critical_alerts_count: number;
  avg_network_latency: number;
  total_rx_mbps: number;
  total_tx_mbps: number;
  fleet_health_score: number; // 0-100
}
