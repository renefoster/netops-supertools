# AGENTS.md — NetOps SuperTools

> AI agent reference document. Read this fully before writing any code.
> Stack: Node.js (backend) + Vanilla JS/HTML or React (frontend). Dark OPS dashboard theme.

---

## 1. PROJECT OVERVIEW

A self-hosted network operations platform for IT Officers managing enterprise network infrastructure.
Runs natively on Linux or via Docker on Windows. No cloud dependency required.

**Core Capabilities:**
- Live device monitoring (ping, SNMP, RouterOS API, SSH)
- Network infrastructure mapping & topology visualization
- Automated troubleshooting & root cause analysis
- Device inventory management
- Config backup & automation scheduler
- Multi-vendor device support (Mikrotik, Ubiquiti, Cisco, TP-Link, generic SSH)

---

## 2. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                  │
│  Dashboard UI ←── Socket.IO/SSE ──→ REST API (Express)│
└─────────────────────┬───────────────────────────────┘
                       │
┌─────────────────────▼───────────────────────────────┐
│                  SERVER (Node.js)                    │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Poller  │  │Discovery │  │  Analysis Engine  │  │
│  │  Engine  │  │  Engine  │  │  (RCA + Anomaly)  │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                  │             │
│  ┌────▼──────────────▼──────────────────▼─────────┐ │
│  │              Data Layer (SQLite/Store)           │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │Scheduler │  │  Alert   │  │  Report Generator │  │
│  │(node-cron│  │  Manager │  │  (PDF/HTML)       │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 3. CORE MODULES & FLOWS

### A. Polling Engine
- Protocols: ICMP ping, SNMP v1/v2c/v3, Mikrotik RouterOS API, SSH.
- Per-device polling intervals with configurable thresholds.
- Tracks latency, packet loss, CPU %, memory %, uptime, interface traffic stats.
- Auto-down detection after consecutive failures (default: 3).

### B. Root Cause Analysis (RCA) Engine
- Built from `upstream_id` dependency chain.
- When an upstream core/distribution switch fails, downstream devices are tagged as "affected" rather than triggering alert storms.
- Pinpoints the single true failure root cause.

### C. Anomaly Detection Engine
- Rolling averages (latency spikes > 3x baseline, packet loss > 5%, CPU > 90%, interface traffic spikes > 5x).
- Auto-generates proactive warnings.

### D. Subnet Discovery & Mapping
- CIDR IP scanning, ARP ping, DNS reverse lookup, MAC OUI vendor resolution, quick port probing.
- Interactive network topology visualizer with real-time health coloring & link status.

### E. Diagnostics Toolkit
- Live Ping, Traceroute, Port Scanner, Local Speedtest & DNS Lookup.

### F. Backup & Config Management
- Device configuration snapshots, automated scheduled backups, diff viewer.

### G. Reports & Logs
- Incident history, uptime SLA reports, network performance analytics, exportable summaries.
