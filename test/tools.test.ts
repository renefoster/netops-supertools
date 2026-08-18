import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DiagnosticTools } from '../server/tools/diagnosticTools';
import { DiscoveryManager } from '../server/discovery/discoveryManager';
import { RCAEngine } from '../server/analysis/rcaEngine';
import { AnomalyEngine } from '../server/analysis/anomalyEngine';
import { BackupManager } from '../server/backup/backupManager';
import { SetupManager, validatePasswordStrength } from '../server/config/setupManager';
import { db } from '../server/db';
import { PollResult } from '../src/types/netops';

describe(' NetOps Super Tools - Complete Unit Test Suite', () => {
  // Test 1: ICMP Echo Ping Tool
  describe('Tool: DiagnosticTools.ping()', () => {
    it('should ping an active core gateway IP and return latency sequence with 0% packet loss', async () => {
      const result = await DiagnosticTools.ping('192.168.1.1', 4);

      assert.equal(result.ip, '192.168.1.1');
      assert.equal(result.packets_sent, 4);
      assert.equal(result.packets_received, 4);
      assert.equal(result.packet_loss_pct, 0);
      assert.ok(result.avg_ms > 0, 'Average latency should be > 0ms');
      assert.ok(result.min_ms <= result.max_ms, 'Min latency <= Max latency');
      assert.equal(result.sequence.length, 4);
      assert.equal(result.sequence[0].bytes, 64);
      assert.equal(result.sequence[0].ttl, 64);
    });

    it('should calculate 100% packet loss when target device has simulated failure injected', async () => {
      const targetDev = Array.from(db.devices.values())[0];
      assert.ok(targetDev, 'Fleet should contain at least 1 device');

      db.simFailures.add(targetDev.id);

      try {
        const result = await DiagnosticTools.ping(targetDev.ip, 3);
        assert.equal(result.packets_sent, 3);
        assert.equal(result.packets_received, 0);
        assert.equal(result.packet_loss_pct, 100);
      } finally {
        db.simFailures.delete(targetDev.id);
      }
    });
  });

  // Test 2: Visual Hop-by-Hop Traceroute Tool
  describe('Tool: DiagnosticTools.traceroute()', () => {
    it('should trace route with hop count, IP addresses, hostnames and RTT timings', async () => {
      const result = await DiagnosticTools.traceroute('192.168.1.50');

      assert.equal(result.target, '192.168.1.50');
      assert.ok(result.hops.length >= 2, 'Traceroute should contain multiple network hops');
      assert.equal(result.hops[0].hop, 1);
      assert.equal(result.hops[0].ip, '192.168.1.1');
      assert.equal(result.hops[0].status, 'ok');
      assert.ok(result.hops[0].rtt1 > 0, 'Hop RTT1 must be > 0ms');
    });
  });

  // Test 3: TCP Port & Service Scanner
  describe('Tool: DiagnosticTools.portScan()', () => {
    it('should scan TCP ports and identify open management services', async () => {
      const result = await DiagnosticTools.portScan('192.168.1.1', [22, 80, 8291, 9999]);

      assert.equal(result.ip, '192.168.1.1');
      assert.equal(result.results.length, 4);

      const winboxPort = result.results.find((r) => r.port === 8291);
      assert.ok(winboxPort, 'Port 8291 (WinBox) should be tested');
      assert.equal(winboxPort?.state, 'open');

      const httpPort = result.results.find((r) => r.port === 80);
      assert.ok(httpPort, 'Port 80 (HTTP) should be tested');
      assert.equal(httpPort?.state, 'open');

      const closedPort = result.results.find((r) => r.port === 9999);
      assert.ok(closedPort, 'Port 9999 should be tested');
      assert.equal(closedPort?.state, 'closed');
    });
  });

  // Test 4: DNS Lookup Tool
  describe('Tool: DiagnosticTools.dnsLookup()', () => {
    it('should resolve local A records and reverse PTR queries', async () => {
      const result = await DiagnosticTools.dnsLookup('router..lan', 'A');

      assert.equal(result.query, 'router..lan');
      assert.equal(result.type, 'A');
      assert.ok(result.records.length > 0, 'Should return DNS records');
      assert.equal(result.records[0].value, '192.168.1.1');
      assert.ok(result.response_time_ms >= 0);
    });

    it('should resolve MX records with mail server host', async () => {
      const result = await DiagnosticTools.dnsLookup('.lan', 'MX');

      assert.equal(result.type, 'MX');
      assert.ok(result.records.length > 0);
      assert.ok(result.records[0].value.includes('mail..lan'));
    });
  });

  // Test 5: Local & WAN Speedtest Tool
  describe('Tool: DiagnosticTools.speedtest()', () => {
    it('should measure throughput and return download, upload, ping, and jitter', async () => {
      const result = await DiagnosticTools.speedtest();

      assert.ok(result.download_mbps > 50, 'Download throughput should be > 50 Mbps');
      assert.ok(result.upload_mbps > 20, 'Upload throughput should be > 20 Mbps');
      assert.ok(result.ping_ms > 0, 'Ping latency should be > 0ms');
      assert.ok(result.isp.length > 0, 'ISP name should not be empty');
      assert.ok(result.wan_ip.length > 0, 'WAN IP should not be empty');
    });
  });

  // Test 6: AI Diagnostic & Action Plan Engine (Gemini 3.6 Flash)
  describe('Tool: DiagnosticTools.aiTroubleshoot()', () => {
    it('should generate an RCA diagnosis and structured action plan using Gemini 3.6 Flash', async () => {
      const result = await DiagnosticTools.aiTroubleshoot(
        ' 1 AP-01 latency is spiking to 150ms and guests report Zoom drops'
      );

      assert.ok(result.model_used.includes('gemini-3.6-flash'), 'Should utilize Gemini 3.6 Flash');
      assert.ok(result.raw_markdown.length > 50, 'Markdown diagnosis should be rich and detailed');
      
      if (result.action_plan_summary) {
        assert.ok(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(result.action_plan_summary.incident_severity));
        assert.ok(result.action_plan_summary.root_cause.length > 0);
        assert.ok(result.action_plan_summary.immediate_steps.length >= 2);
        assert.ok(result.action_plan_summary.cli_commands.length >= 1);
        assert.ok(result.action_plan_summary.preventative_actions.length >= 1);
      }
    });
  });

  // Test 7: Subnet Discovery Engine & OUI Vendor Resolution
  describe('Engine: DiscoveryManager', () => {
    it('should generate IP addresses correctly from CIDR notation', () => {
      const ips24 = DiscoveryManager.generateIpsFromSubnet('192.168.1.0/24');
      assert.equal(ips24.length, 254);
      assert.equal(ips24[0], '192.168.1.1');
      assert.equal(ips24[253], '192.168.1.254');

      const ips28 = DiscoveryManager.generateIpsFromSubnet('10.0.0.0/28');
      assert.equal(ips28.length, 14);
    });

    it('should accurately resolve hardware vendors from IEEE MAC OUI prefixes', () => {
      const mikrotik = DiscoveryManager.resolveVendorFromMac('48:8F:5A:12:34:56');
      assert.equal(mikrotik.brand, 'mikrotik');
      assert.equal(mikrotik.vendor, 'MikroTik');
      assert.equal(mikrotik.type, 'router');

      const cisco = DiscoveryManager.resolveVendorFromMac('00:26:0B:AA:BB:CC');
      assert.equal(cisco.brand, 'cisco');
      assert.equal(cisco.type, 'switch');

      const ubi = DiscoveryManager.resolveVendorFromMac('74:83:C2:11:22:33');
      assert.equal(ubi.brand, 'ubiquiti');
      assert.equal(ubi.type, 'ap');

      const hik = DiscoveryManager.resolveVendorFromMac('BC:AD:28:44:55:66');
      assert.equal(hik.brand, 'hikvision');
      assert.equal(hik.type, 'camera');
    });

    it('should initiate subnet discovery scan session', async () => {
      const session = await DiscoveryManager.runScan('192.168.1.0/28');
      assert.ok(session.scan_id.startsWith('scan-'));
      assert.equal(session.subnet, '192.168.1.0/28');
      assert.ok(session.total_ips > 0);
    });
  });

  // Test 8: Root Cause Analysis (RCA) Engine
  describe('Engine: RCAEngine', () => {
    it('should traverse downstream dependency tree recursively', () => {
      const rootDev = Array.from(db.devices.values()).find((d) => d.type === 'router');
      assert.ok(rootDev, 'Root router must exist');

      const downstream = RCAEngine.getDownstreamDevices(rootDev.id);
      assert.ok(downstream.length > 0, 'Root router should have downstream switches and APs');
    });

    it('should isolate root cause and suppress cascade alerts when upstream switch fails', () => {
      const swDev = Array.from(db.devices.values()).find((d) => d.id === 'dev-sw1' || d.type === 'switch');
      if (swDev) {
        db.simFailures.add(swDev.id);

        try {
          const rca = RCAEngine.evaluateAllActiveIncidents();
          assert.ok(rca.length >= 1, 'RCA should detect the failed upstream switch');
          const rootMatch = rca.find((r) => r.root_cause_device_id === swDev.id);
          assert.ok(rootMatch, 'Failed switch should be flagged as the true root cause');
          assert.ok(rootMatch.affected_device_ids.length > 0, 'Downstream nodes should be marked as affected');
        } finally {
          db.simFailures.delete(swDev.id);
        }
      }
    });
  });

  // Test 9: Statistical Anomaly Detection Engine
  describe('Engine: AnomalyEngine', () => {
    it('should detect packet loss anomalies exceeding threshold', () => {
      const testPoll: PollResult = {
        device_id: 'dev-r1',
        status: 'degraded',
        latency_ms: 12.0,
        packet_loss: 15.0, // Exceeds 5% threshold
        cpu_pct: 25,
        mem_pct: 40,
        uptime_sec: 50000,
        timestamp: Date.now(),
      };

      // Seed poll history
      db.pollHistory.set('dev-r1', [
        { ...testPoll, latency_ms: 2.0, packet_loss: 0 },
        { ...testPoll, latency_ms: 2.1, packet_loss: 0 },
        { ...testPoll, latency_ms: 2.0, packet_loss: 0 },
        { ...testPoll, latency_ms: 2.2, packet_loss: 0 },
        { ...testPoll, latency_ms: 2.0, packet_loss: 0 },
        { ...testPoll, latency_ms: 2.1, packet_loss: 0 },
      ]);

      const anomalies = AnomalyEngine.evaluatePoll(testPoll);
      assert.ok(anomalies.length > 0, 'Should detect anomaly');
      const packetLossAnomaly = anomalies.find((a) => a.metric === 'packet_loss');
      assert.ok(packetLossAnomaly, 'Should flag packet loss anomaly');
    });
  });

  // Test 10: Configuration Backup Manager
  describe('Engine: BackupManager', () => {
    it('should export native configuration snapshot for MikroTik and Cisco devices', async () => {
      const mikrotikDev = Array.from(db.devices.values()).find((d) => d.brand === 'mikrotik');
      assert.ok(mikrotikDev, 'MikroTik device should exist in fleet');

      const backup = await BackupManager.runBackupForDevice(mikrotikDev.id);
      assert.equal(backup.device_id, mikrotikDev.id);
      assert.ok(backup.filename.endsWith('.rsc'), 'MikroTik backup file should have .rsc extension');
      assert.ok(backup.content.includes('/system identity'), 'Config should contain RouterOS commands');
      assert.ok(backup.size_bytes > 0, 'Backup size should be > 0 bytes');
    });
  });

  // Test 11: Setup & Security Engine
  describe('Engine: SetupManager & First-Time Wizard', () => {
    it('should validate strong passwords (12+ chars with upper, lower, numeric, special)', () => {
      const valid = validatePasswordStrength('Ops@2026Secure!');
      assert.equal(valid.isValid, true);
      assert.equal(valid.hasMinLength, true);
      assert.equal(valid.hasUppercase, true);
      assert.equal(valid.hasLowercase, true);
      assert.equal(valid.hasNumber, true);
      assert.equal(valid.hasSpecial, true);

      // Short password failure
      const tooShort = validatePasswordStrength('Short1@');
      assert.equal(tooShort.isValid, false);
      assert.equal(tooShort.hasMinLength, false);

      // Missing special character failure
      const noSpecial = validatePasswordStrength('Ops2026Secure');
      assert.equal(noSpecial.isValid, false);
      assert.equal(noSpecial.hasSpecial, false);
    });

    it('should scan sqlite storage directory and test database connectivity', () => {
      const sqliteScan = SetupManager.scanSqliteDirectory();
      assert.ok(typeof sqliteScan.exists === 'boolean');
      assert.ok(sqliteScan.path.includes('netops.db'));

      const testConn = SetupManager.testDatabaseConnection({ type: 'sqlite' });
      assert.equal(testConn.success, true);
      assert.ok(testConn.message.length > 0);
    });
  });
});
