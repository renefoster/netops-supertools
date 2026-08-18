# NetOps SuperTools

> **Self-Hosted Network Operations & Infrastructure Management Platform for IT Officers & Network Engineers.**

[![Stack](https://img.shields.io/badge/Stack-Node.js%20%7C%20Express%20%7C%20React%20%7C%20Tailwind-blue)](#)
[![License](https://img.shields.io/badge/License-MIT-emerald)](#)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success)](#)

---

## 📋 Table of Contents
- [1. Overview](#1-overview)
- [2. Primary Goals](#2-primary-goals)
- [3. Key Features](#3-key-features)
- [4. Architecture & Technical Stack](#4-architecture--technical-stack)
- [5. System Limitations](#5-system-limitations)
- [6. Installation & Deployment Guide](#6-installation--deployment-guide)
  - [Prerequisites](#prerequisites)
  - [Option A: Standard Node.js (Local / Server)](#option-a-standard-nodejs-local--server)
  - [Option B: Docker Container Deployment](#option-b-docker-container-deployment)
  - [Option C: Docker Compose](#option-c-docker-compose)
- [7. Default Credentials & First Boot](#7-default-credentials--first-boot)
- [8. Project Structure](#8-project-structure)

---

## 1. Overview

**NetOps SuperTools** is an all-in-one network monitoring, discovery, troubleshooting, and configuration management platform designed for IT Officers and network engineers managing enterprise networks, offices, facilities, and distributed infrastructure.

It operates **100% locally** with zero mandatory cloud dependencies, providing immediate visibility into multi-vendor hardware fleets including **MikroTik RouterOS**, **Cisco Systems**, **Ubiquiti UniFi**, **TP-Link**, and generic Linux/SSH devices.

---

## 2. Primary Goals

1. **Eliminate Alert Storms**: Utilize upstream dependency mapping (`upstream_id`) so that when a core distribution switch fails, downstream devices are identified as "affected" rather than firing hundreds of false-positive down alerts.
2. **Local-First Reliability**: Run on local Linux hardware or Windows container hosts without requiring external SaaS subscriptions or internet access for core poller functions.
3. **Multi-Vendor Configuration Protection**: Automate nightly/weekly configuration exports (RouterOS `.rsc` exports, Cisco `running-config`, etc.) with side-by-side diff inspection.
4. **AI-Assisted Troubleshooting**: Provide IT officers with on-demand AI root cause diagnosis, step-by-step resolution steps, and vendor-specific CLI commands.
5. **Auditable SLA Reports**: Generate exportable, printable executive reports and SLA compliance matrices for property management and guests.

---

## 3. Key Features

### 📡 Live Polling & Health Engine
- **Protocols**: ICMP Ping, SNMP v1/v2c/v3, MikroTik RouterOS API, SSH.
- **Metrics Tracked**: Round-trip latency (ms), packet loss (%), CPU load (%), memory usage (%), system uptime, interface TX/RX speeds (Mbps).
- **Auto-Down Detection**: Configurable consecutive failure thresholds (default: 3 missed polls).

### 🗺️ Interactive Network Topology Visualizer
- **4-Tier Network Hierarchy**: Visual layout organized into *Core Gateway*, *Distribution*, *Access*, and *Edge/Device* layers.
- **Interactive Controls**: Drag-and-drop node positioning, zoom/pan controls, zone filtering, and auto-layout formatting.
- **Real-Time Health Color Coding**: Instant visual status representation (Green = Healthy, Yellow = Latency Spike, Red = Down/Failure).

### 🎯 Root Cause Analysis (RCA) & Anomaly Detection
- **Cascade Prevention**: Pinpoints the exact failure root cause in a multi-node chain.
- **Proactive Warnings**: Detects latency spikes (>3x baseline), elevated packet loss (>5%), CPU saturation (>90%), and bandwidth spikes (>5x baseline).

### 🔎 Subnet Discovery & Inventory
- **Parallel Subnet Sweeper**: Scans arbitrary CIDR blocks (e.g., `192.168.1.0/24`, `10.20.0.0/24`).
- **Vendor & MAC OUI Fingerprinting**: Automatic brand resolution (MikroTik, Cisco, Ubiquiti, TP-Link, Apple, Sony, etc.) and open port probing (22, 80, 443, 8291, etc.).
- **One-Click Import**: Instantly add discovered hardware into live monitoring.

### 🛠️ Integrated Diagnostics & AI Assistant
- **Built-in Network Tools**: Live Ping, Traceroute hop visualizer, Port Scanner, DNS Resolver, and Local Speedtest engine.
- **Gemini AI Operations Assistant**: Guided incident playbooks, root cause correlation, step-by-step checklists, and ready-to-run vendor CLI commands.

### 💾 Configuration Vault & Automation
- **Scheduled Backups**: Automated `node-cron` schedules (e.g., nightly core router exports, weekly switch snapshots).
- **Side-by-Side Diff Viewer**: Compare configuration changes between snapshot versions to track configuration drift.
- **Export & Restore**: One-click download of `.rsc` or `.cfg` configuration files.

### 📊 Executive SLA & Audit Reporting
- **Multi-Period Metrics**: Calculate SLA uptime percentages for 24-hour, 7-day, and 30-day windows.
- **Export Options**: Export formatted technical summary documents, print directly to PDF/Printer, save standalone styled HTML reports, or download raw JSON datasets.

---

## 4. Architecture & Technical Stack

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                  │
│  Dark OPS Dashboard UI ←─ REST API / Socket Polling  │
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
│  │              Local JSON Data Layer               │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │Scheduler │  │  Alert   │  │  Report Generator │  │
│  │(node-cron│  │  Manager │  │  (PDF/HTML)       │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Motion.
- **Backend**: Node.js, Express, `node-cron`, esbuild, TSX.
- **Data Persistence**: File-system backed JSON database (`/data`) with self-healing initial seeders.

---

## 5. System Limitations

1. **Raw ICMP Socket Permissions**: Standard web container environments may restrict raw ICMP socket creation without root privileges. The application includes synthetic socket fallback pollers to ensure continuous operational reporting.
2. **Storage Scale**: The default storage engine uses atomic JSON files in `/data/`, which is optimized for single-property or multi fleets (up to ~500 monitored devices). For enterprise fleets with thousands of devices, `server/db.ts` can be connected to SQLite or PostgreSQL.
3. **AI Features**: AI Diagnosis playbooks utilize Google Gemini API (`GEMINI_API_KEY`). If no API key is set, local heuristic diagnostics will handle incident reports without external API calls.

---

## 6. Installation & Deployment Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- *(Optional)* **Docker**: v20.10+ for containerized setup

---

### Option A: Standard Node.js (Local / Server)

```bash
# 1. Clone the repository
git clone https://github.com/renefostername/netops-super-tools.git
cd netops-super-tools

# 2. Install dependencies
npm install

# 3. Create environment configuration (optional for AI features)
cp .env.example .env

# 4. Start Development Server
npm run dev
# App will run at: http://localhost:3000

# 5. Build and Run Production Server
npm run build
npm start
```

---

### Option B: Docker Container Deployment

```bash
# 1. Build Docker Image
docker build -t netops-supertools .

# 2. Run Docker Container
docker run -d \
  --name netops-supertools \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  netops-supertools

# Access dashboard at http://localhost:3000
```

---

### Option C: Docker Compose

Create a `docker-compose.yml` file in your root folder:

```yaml
version: '3.8'

services:
  netops-supertools:
    build: .
    container_name: netops-supertools
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - GEMINI_API_KEY=${GEMINI_API_KEY:-}
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

---

## 7. Default Credentials & First Boot

On initial launch, the application presents a blank authentication screen. You can log in using default IT Officer administrative credentials or customize them in settings:

- **Default Username**: `admin`
- **Default Password**: `admin123`

*Note: All persistent device data, alerts, and backup configurations will be stored in the `./data` directory.*

---

## 8. Project Structure

```
.
├── data/                   # Persistent local storage (devices, alerts, backups)
├── server.ts               # Express server entry point & API routes
├── server/
│   ├── config.ts           # Initial seeded hardware topology
│   ├── db.ts               # Database layer & file storage engine
│   └── routes/             # API route handlers (poller, discovery, backups, diagnostics)
├── src/
│   ├── App.tsx             # Main App layout & View routing
│   ├── components/
│   │   ├── navigation/     # Header bar & tab navigation
│   │   ├── ui/             # Reusable UI controls & Pagination
│   │   └── views/          # Overview, Topology, Inventory, Discovery, Diagnostics, Backup, Reports
│   ├── context/            # NetOpsContext state provider
│   └── types/              # TypeScript definitions
├── package.json            # Scripts & dependencies
└── Dockerfile              # Production Docker build configuration
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
