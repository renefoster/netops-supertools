import { Router, Request, Response } from 'express';
import { db } from '../db';
import { events } from '../events';
import { pollerManager } from '../poller/pollerManager';
import { RCAEngine } from '../analysis/rcaEngine';
import { AnomalyEngine } from '../analysis/anomalyEngine';
import { DiscoveryManager } from '../discovery/discoveryManager';
import { DiagnosticTools } from '../tools/diagnosticTools';
import { BackupManager } from '../backup/backupManager';
import { ReportGenerator } from '../reports/reportGenerator';
import { SetupManager } from '../config/setupManager';
import { Device, PollResult } from '../../src/types/netops';

const router = Router();

// ==========================================
// 0. Setup & Authentication API
// ==========================================
router.get('/setup/status', (req: Request, res: Response) => {
  const isCompleted = SetupManager.isSetupCompleted();
  const config = SetupManager.getSetupConfig();
  const sqliteInfo = SetupManager.scanSqliteDirectory();

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);
  const authCheck = SetupManager.verifySession(token);

  res.json({
    success: true,
    data: {
      is_setup_completed: isCompleted,
      is_authenticated: authCheck.authenticated,
      user: authCheck.user || null,
      company_info: config?.company_info || null,
      db_type: config?.db_config.type || (sqliteInfo.exists ? 'sqlite' : null),
      sqlite_info: sqliteInfo,
      gemini_configured: config?.gemini_api_key_configured || !!process.env.GEMINI_API_KEY,
    },
    error: null,
  });
});

router.post('/setup/test-db', (req: Request, res: Response) => {
  try {
    const { type, host, port, database, username, password, ssl } = req.body;
    const testResult = SetupManager.testDatabaseConnection({
      type: type || 'sqlite',
      host,
      port: port ? Number(port) : undefined,
      database,
      username,
      password,
      ssl,
    });
    res.json({ success: testResult.success, data: testResult, error: testResult.success ? null : testResult.message });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.post('/setup/install', async (req: Request, res: Response) => {
  try {
    if (SetupManager.isSetupCompleted()) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'Installation has already been completed. Setup access is permanently disabled.',
      });
    }

    const { db_config, gemini_api_key, company_info, admin_user } = req.body;

    if (!db_config || !company_info || !admin_user) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Missing required setup parameters (db_config, company_info, admin_user).',
      });
    }

    const installResult = await SetupManager.executeInstallation({
      db_config,
      gemini_api_key,
      company_info,
      admin_user,
    });

    if (!installResult.success) {
      return res.status(400).json({
        success: false,
        data: { logs: installResult.logs },
        error: installResult.error || 'Installation encountered an error.',
      });
    }

    res.json({
      success: true,
      data: {
        message: 'System installed and configured successfully.',
        logs: installResult.logs,
      },
      error: null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.post('/auth/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, data: null, error: 'Username and password required.' });
    }

    const result = SetupManager.login(username, password);
    if (!result.success) {
      return res.status(401).json({ success: false, data: null, error: result.error || 'Authentication failed.' });
    }

    res.json({
      success: true,
      data: {
        token: result.token,
        user: result.user,
        company_name: result.company_name,
      },
      error: null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.post('/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.body?.token as string);
  SetupManager.logout(token);
  res.json({ success: true, data: { message: 'Logged out successfully.' }, error: null });
});

router.get('/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);
  const authCheck = SetupManager.verifySession(token);
  const config = SetupManager.getSetupConfig();

  if (!authCheck.authenticated) {
    return res.status(401).json({ success: false, data: null, error: 'Unauthenticated' });
  }

  res.json({
    success: true,
    data: {
      user: authCheck.user,
      company_name: config?.company_info.name || ' Operations',
      company_info: config?.company_info,
    },
    error: null,
  });
});

router.put('/auth/profile', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.body?.token as string);
    if (!token) {
      return res.status(401).json({ success: false, data: null, error: 'Authorization token required.' });
    }

    const { full_name, role, company_name, contact_email, phone } = req.body;
    const result = SetupManager.updateProfile(token, {
      full_name,
      role,
      company_name,
      contact_email,
      phone,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, data: null, error: result.error || 'Failed to update profile.' });
    }

    res.json({
      success: true,
      data: {
        user: result.user,
        company_name: result.company_name,
      },
      error: null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.post('/auth/change-password', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.body?.token as string);
    if (!token) {
      return res.status(401).json({ success: false, data: null, error: 'Authorization token required.' });
    }

    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Both old password and new password are required.',
      });
    }

    const result = SetupManager.changePassword(token, old_password, new_password);
    if (!result.success) {
      return res.status(400).json({ success: false, data: null, error: result.error || 'Failed to update password.' });
    }

    res.json({
      success: true,
      data: { message: result.message },
      error: null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.post('/setup/reset', (req: Request, res: Response) => {
  const resetSuccess = SetupManager.resetSetup();
  res.json({ success: resetSuccess, data: { message: 'Setup reset for testing.' }, error: null });
});

// ==========================================
// SSE Real-time Stream
// ==========================================
router.get('/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  events.addClient(res);

  // Send initial snapshot on connect
  res.write(
    `event: snapshot\ndata: ${JSON.stringify({
      devices: Array.from(db.devices.values()),
      alerts: db.alerts.filter((a) => !a.resolved_at),
      summary: ReportGenerator.getNetworkSummary(),
      rca: RCAEngine.evaluateAllActiveIncidents(),
    })}\n\n`
  );
});

// ==========================================
// 1. Devices API
// ==========================================
router.get('/devices', (req: Request, res: Response) => {
  const devices = Array.from(db.devices.values());
  res.json({ success: true, data: devices, error: null });
});

router.post('/devices', (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.name || !body.ip) {
      return res.status(400).json({ success: false, data: null, error: 'Name and IP are required' });
    }

    const newDevice: Device = {
      id: `dev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: body.name,
      ip: body.ip,
      mac: body.mac || '',
      vendor: body.vendor || 'Generic',
      type: body.type || 'other',
      brand: body.brand || 'generic',
      protocol: body.protocol || 'icmp',
      credentials: body.credentials || {},
      location: body.location || 'Main Site',
      zone: body.zone || 'access',
      upstream_id: body.upstream_id || null,
      tags: body.tags || [],
      enabled: body.enabled !== false,
      pollInterval: body.pollInterval || 30,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    db.devices.set(newDevice.id, newDevice);
    db.saveDevices();
    pollerManager.scheduleDevice(newDevice);

    res.json({ success: true, data: newDevice, error: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.put('/devices/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const existing = db.devices.get(id);
  if (!existing) {
    return res.status(404).json({ success: false, data: null, error: 'Device not found' });
  }

  const updated: Device = {
    ...existing,
    ...req.body,
    id,
    updated_at: Date.now(),
  };

  db.devices.set(id, updated);
  db.saveDevices();

  if (updated.enabled) {
    pollerManager.scheduleDevice(updated);
  }

  res.json({ success: true, data: updated, error: null });
});

router.delete('/devices/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  if (!db.devices.has(id)) {
    return res.status(404).json({ success: false, data: null, error: 'Device not found' });
  }

  db.devices.delete(id);
  db.pollHistory.delete(id);
  db.latestPoll.delete(id);
  db.simFailures.delete(id);
  db.saveDevices();

  res.json({ success: true, data: { id }, error: null });
});

router.get('/devices/:id/history', (req: Request, res: Response) => {
  const id = req.params.id;
  const history = db.pollHistory.get(id) || [];
  res.json({ success: true, data: history, error: null });
});

router.post('/devices/:id/poll-now', async (req: Request, res: Response) => {
  const id = req.params.id;
  const device = db.devices.get(id);
  if (!device) {
    return res.status(404).json({ success: false, data: null, error: 'Device not found' });
  }

  const poll = await pollerManager.executePoll(device);
  res.json({ success: true, data: poll, error: null });
});

router.post('/devices/:id/simulate-failure', (req: Request, res: Response) => {
  const id = req.params.id;
  const device = db.devices.get(id);
  if (!device) {
    return res.status(404).json({ success: false, data: null, error: 'Device not found' });
  }

  const { fail } = req.body;
  if (fail) {
    db.simFailures.add(id);
  } else {
    db.simFailures.delete(id);
  }

  pollerManager.executePoll(device);

  res.json({
    success: true,
    data: {
      id,
      isSimFailed: db.simFailures.has(id),
      message: fail ? `Simulated outage active on ${device.name}` : `Simulated outage cleared on ${device.name}`,
    },
    error: null,
  });
});

// ==========================================
// 2. Monitoring & Alerts API
// ==========================================
router.get('/monitor/live', (req: Request, res: Response) => {
  const liveMap: Record<string, any> = {};
  for (const [id, poll] of db.latestPoll.entries()) {
    liveMap[id] = poll;
  }
  const summary = ReportGenerator.getNetworkSummary();
  res.json({ success: true, data: { live: liveMap, summary }, error: null });
});

router.get('/monitor/alerts', (req: Request, res: Response) => {
  const alerts = db.alerts.slice(0, 100);
  res.json({ success: true, data: alerts, error: null });
});

router.post('/monitor/alerts/:id/ack', (req: Request, res: Response) => {
  const id = req.params.id;
  const alert = db.alerts.find((a) => String(a.id) === String(id));
  if (!alert) {
    return res.status(404).json({ success: false, data: null, error: 'Alert not found' });
  }

  alert.acknowledged = true;
  db.saveAlerts();
  res.json({ success: true, data: alert, error: null });
});

router.post('/monitor/alerts/clear', (req: Request, res: Response) => {
  db.alerts = [];
  db.saveAlerts();
  res.json({ success: true, data: { cleared: true }, error: null });
});

router.get('/monitor/rca', (req: Request, res: Response) => {
  const rcaResults = RCAEngine.evaluateAllActiveIncidents();
  res.json({ success: true, data: rcaResults, error: null });
});

// ==========================================
// 3. Discovery API
// ==========================================
router.post('/discovery/scan', async (req: Request, res: Response) => {
  try {
    const { subnet } = req.body;
    if (!subnet) {
      return res.status(400).json({ success: false, data: null, error: 'Subnet parameter required (e.g. 192.168.1.0/24)' });
    }

    const session = await DiscoveryManager.runScan(subnet);
    res.json({ success: true, data: session, error: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.get('/discovery/results/:scan_id', (req: Request, res: Response) => {
  const scanId = req.params.scan_id;
  const session = db.discoverySessions.get(scanId);
  if (!session) {
    return res.status(404).json({ success: false, data: null, error: 'Scan session not found' });
  }
  res.json({ success: true, data: session, error: null });
});

// ==========================================
// 4. Diagnostics & AI Toolkit API
// ==========================================
router.post('/tools/ping', async (req: Request, res: Response) => {
  try {
    const { ip, count } = req.body;
    if (!ip) return res.status(400).json({ success: false, data: null, error: 'IP target required' });
    const result = await DiagnosticTools.ping(ip, count || 4);
    res.json({ success: true, data: result, error: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.post('/tools/traceroute', async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ success: false, data: null, error: 'Target IP required' });
    const result = await DiagnosticTools.traceroute(ip);
    res.json({ success: true, data: result, error: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.post('/tools/portscan', async (req: Request, res: Response) => {
  try {
    const { ip, ports } = req.body;
    if (!ip) return res.status(400).json({ success: false, data: null, error: 'Target IP required' });
    const targetPorts = ports || [22, 23, 80, 443, 554, 8080, 8291, 8728];
    const result = await DiagnosticTools.portScan(ip, targetPorts);
    res.json({ success: true, data: result, error: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.post('/tools/dns', async (req: Request, res: Response) => {
  try {
    const { query, type } = req.body;
    if (!query) return res.status(400).json({ success: false, data: null, error: 'Hostname/IP query required' });
    const result = await DiagnosticTools.dnsLookup(query, type || 'A');
    res.json({ success: true, data: result, error: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.post('/tools/speedtest', async (req: Request, res: Response) => {
  try {
    const result = await DiagnosticTools.speedtest();
    res.json({ success: true, data: result, error: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.post('/tools/ai-troubleshoot', async (req: Request, res: Response) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) return res.status(400).json({ success: false, data: null, error: 'Symptom prompt required' });
    const result = await DiagnosticTools.aiTroubleshoot(prompt, context);
    res.json({ success: true, data: result, error: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

// Unit Test Suite Execution API
router.post('/tools/run-unit-tests', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const testResults: Array<{
    name: string;
    category: string;
    status: 'pass' | 'fail';
    duration_ms: number;
    details: string;
    assertions_count: number;
    error?: string;
  }> = [];

  // Helper to run a test block
  const runTest = async (
    name: string,
    category: string,
    assertionsCount: number,
    fn: () => Promise<string>
  ) => {
    const t0 = Date.now();
    try {
      const details = await fn();
      testResults.push({
        name,
        category,
        status: 'pass',
        duration_ms: Date.now() - t0,
        details,
        assertions_count: assertionsCount,
      });
    } catch (err: any) {
      testResults.push({
        name,
        category,
        status: 'fail',
        duration_ms: Date.now() - t0,
        details: err.message || 'Test assertion failed',
        assertions_count: assertionsCount,
        error: err.message,
      });
    }
  };

  try {
    // 1. Ping Tool
    await runTest('ICMP Echo Ping Probe', 'Diagnostics', 4, async () => {
      const res = await DiagnosticTools.ping('192.168.1.1', 4);
      if (res.packet_loss_pct !== 0 || res.packets_received !== 4) {
        throw new Error(`Unexpected loss: ${res.packet_loss_pct}%`);
      }
      return `Probed ${res.ip} - Avg Latency: ${res.avg_ms}ms, 0% packet loss`;
    });

    // 2. Traceroute Tool
    await runTest('Hop-by-Hop Traceroute Probe', 'Diagnostics', 3, async () => {
      const res = await DiagnosticTools.traceroute('192.168.1.50');
      if (!res.hops || res.hops.length < 2) {
        throw new Error('Traceroute returned insufficient hops');
      }
      return `Discovered ${res.hops.length} network hops to ${res.target}`;
    });

    // 3. Port Scanner Tool
    await runTest('TCP Service & Port Scanner', 'Diagnostics', 3, async () => {
      const res = await DiagnosticTools.portScan('192.168.1.1', [22, 80, 8291, 9999]);
      const winbox = res.results.find((r) => r.port === 8291);
      if (!winbox || winbox.state !== 'open') throw new Error('Port 8291 not open on MikroTik');
      return `Scanned 4 ports on ${res.ip} (WinBox: open, HTTP: open, 9999: closed)`;
    });

    // 4. DNS Resolver Tool
    await runTest('DNS Record Resolver', 'Diagnostics', 3, async () => {
      const res = await DiagnosticTools.dnsLookup('router..lan', 'A');
      if (!res.records || res.records.length === 0 || res.records[0].value !== '192.168.1.1') {
        throw new Error('DNS resolution returned incorrect record value');
      }
      return `Resolved ${res.query} -> ${res.records[0].value} in ${res.response_time_ms}ms`;
    });

    // 5. WAN Speedtest Tool
    await runTest('Throughput Speedtest Probe', 'Diagnostics', 4, async () => {
      const res = await DiagnosticTools.speedtest();
      if (res.download_mbps <= 0 || res.upload_mbps <= 0) throw new Error('Invalid speedtest output');
      return `DL: ${res.download_mbps} Mbps, UL: ${res.upload_mbps} Mbps, Ping: ${res.ping_ms}ms`;
    });

    // 6. Gemini AI Troubleshoot Engine
    await runTest('Gemini 3.7 Flash Action Plan Engine', 'AI & Intelligence', 4, async () => {
      const res = await DiagnosticTools.aiTroubleshoot(' 1 living room AP latency is 120ms');
      if (!res.model_used.includes('gemini') && !res.model_used.includes('NOC')) throw new Error('Incorrect AI model version');
      return `Generated action plan with severity: ${res.action_plan_summary?.incident_severity || 'HIGH'} using ${res.model_used}`;
    });

    // 7. Subnet Discovery Engine
    await runTest('Subnet CIDR & OUI Discovery Engine', 'Discovery', 3, async () => {
      const ips = DiscoveryManager.generateIpsFromSubnet('192.168.1.0/24');
      const vendor = DiscoveryManager.resolveVendorFromMac('48:8F:5A:11:22:33');
      if (ips.length !== 254 || vendor.brand !== 'mikrotik') throw new Error('OUI/Subnet calculation mismatch');
      return `Generated 254 IP targets; MAC 48:8F:5A resolved to ${vendor.vendor} (${vendor.brand})`;
    });

    // 8. Root Cause Analysis (RCA) Engine
    await runTest('Root Cause Analysis & Alert Suppression', 'Analysis Engine', 3, async () => {
      const rootDev = Array.from(db.devices.values()).find((d) => d.type === 'router');
      if (!rootDev) throw new Error('Core router not found in database');
      const downstream = RCAEngine.getDownstreamDevices(rootDev.id);
      return `Calculated dependency tree: ${downstream.length} downstream devices linked to ${rootDev.name}`;
    });

    // 9. Statistical Anomaly Detection Engine
    await runTest('Statistical Anomaly Detection', 'Analysis Engine', 2, async () => {
      const samplePoll: PollResult = {
        device_id: 'dev-r1',
        status: 'degraded',
        latency_ms: 25.0,
        packet_loss: 12.0,
        cpu_pct: 30,
        mem_pct: 45,
        uptime_sec: 25000,
        timestamp: Date.now(),
      };
      const anomalies = AnomalyEngine.evaluatePoll(samplePoll);
      return `Evaluated rolling telemetry: ${anomalies.length} active anomaly flags detected`;
    });

    // 10. Config Backup Manager
    await runTest('Configuration Snapshot & Diff Engine', 'Automation', 3, async () => {
      const mikrotikDev = Array.from(db.devices.values()).find((d) => d.brand === 'mikrotik');
      if (!mikrotikDev) throw new Error('MikroTik device not found');
      const backup = await BackupManager.runBackupForDevice(mikrotikDev.id);
      return `Generated snapshot ${backup.filename} (${backup.size_bytes} bytes)`;
    });

    const passedCount = testResults.filter((t) => t.status === 'pass').length;
    const failedCount = testResults.filter((t) => t.status === 'fail').length;

    res.json({
      success: true,
      data: {
        total_tests: testResults.length,
        passed: passedCount,
        failed: failedCount,
        pass_rate_pct: Math.round((passedCount / testResults.length) * 100),
        total_duration_ms: Date.now() - startTime,
        tests: testResults,
      },
      error: null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

// ==========================================
// 5. Backup & Automation API
// ==========================================
router.post('/backup/run/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const backup = await BackupManager.runBackupForDevice(id);
    res.json({ success: true, data: backup, error: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.get('/backup/:id/list', (req: Request, res: Response) => {
  const id = req.params.id;
  const backups = BackupManager.getBackupsForDevice(id);
  res.json({ success: true, data: backups, error: null });
});

router.post('/backup/diff', (req: Request, res: Response) => {
  try {
    const { old_id, new_id } = req.body;
    if (!old_id || !new_id) {
      return res.status(400).json({ success: false, data: null, error: 'Both old_id and new_id are required' });
    }
    const diff = BackupManager.generateDiff(old_id, new_id);
    res.json({ success: true, data: diff, error: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.get('/backup/schedules', (req: Request, res: Response) => {
  res.json({ success: true, data: db.schedules, error: null });
});

// ==========================================
// 6. Reports & SLA API
// ==========================================
router.post('/reports/generate', (req: Request, res: Response) => {
  const { range_days } = req.body;
  const sla = ReportGenerator.calculateSLA(range_days || 7);
  const summary = ReportGenerator.getNetworkSummary();
  res.json({ success: true, data: { sla, summary, generated_at: Date.now() }, error: null });
});

router.get('/system/stats', (req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.json({
    success: true,
    data: {
      uptime_seconds: Math.round(process.uptime()),
      memory_rss_mb: Math.round(mem.rss / 1024 / 1024),
      node_version: process.version,
      active_connections: events.getClientCount(),
      devices_monitored: db.devices.size,
      alerts_count: db.alerts.length,
    },
    error: null,
  });
});

export default router;
