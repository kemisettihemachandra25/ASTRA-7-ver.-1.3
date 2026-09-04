# ORION-7 Autonomous Satellite Digital Twin & Swarm Operations Console

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4.0-38bdf8.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.21-000000.svg?logo=express)](https://expressjs.com/)
[![Google GenAI](https://img.shields.io/badge/Google%20GenAI-Gemini%20Flash-orange.svg?logo=google)](https://ai.google.dev/)
[![OrbitGuard API](https://img.shields.io/badge/OrbitGuard-Integrated-green.svg)](https://orbitguard-kt7a.onrender.com)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![Status](https://img.shields.io/badge/IP-Patent%20Pending-critical.svg)](LICENSE)

An aerospace-grade, real-time digital twin, multi-agent autonomous swarm mission operations console, and propellantless orbital mechanics laboratory for Low Earth Orbit (LEO) satellite **ORION-7** (NORAD ID: 59402, 545 km circular orbit, 51.6° inclination).

Integrated with **OrbitGuard Autonomous Satellite Interlocks** and **Google Gemini AI Multi-Model Reasoning** for automated fault detection, Byzantine swarm consensus, and deterministic contingency recovery.

---

## Architecture Overview

```
                      +------------------------------------------+
                      |         MISSION OPERATIONS UI            |
                      |   (React 19 + Tailwind + Lucide Icons)   |
                      +--------------------+---------------------+
                                           |
                                [REST / WebSocket / SSE]
                                           |
                      +--------------------+---------------------+
                      |           EXPRESS GATEWAY                |
                      |   - Telemetry Stream Engine              |
                      |   - Byzantine Raft Consensus Dispatch    |
                      |   - Multi-Model Failover Orchestrator    |
                      +----------+--------------------+----------+
                                 |                    |
                  +--------------+--+              +--+---------------+
                  |                 |              |                  |
+-----------------+----+    +-------+--------+   +-+------------------+-+
| ORBITGUARD ENGINE    |    | GEMINI AI CORE |   | POSTGRESQL DATABASE  |
| - Safety Interlocks  |    | - 3.1 Flash    |   | - 17 Relational Tbls |
| - Reaction Wheel Tol |    | - Flash Latest |   | - Telemetry Timeseries|
| - SoC Margin Checks  |    | - 3.8 Flash    |   | - Aerospace Runbooks |
| - Rollback Auditing  |    | - Root Cause   |   | - Audit Event Ledger |
+----------------------+    +----------------+   +----------------------+
```

---

## Key Capabilities

### 1. Real-Time Aerospace Digital Twin
- **Orbital Mechanics & Ephemeris**: Continuous propagation of altitude (545 km), orbital velocity (7.58 km/s), beta angle, and sun/eclipse cycles.
- **Subsystem Telemetry Streams**:
  - **EPS (Electrical Power)**: Bus voltage (28.4 V), solar array current, battery state-of-charge (SoC: 91.2%), power rail distribution.
  - **ADCS (Attitude Determination & Control)**: Tri-axial reaction wheel speeds ($W_x, W_y, W_z$), magnetic torquers, star tracker quaternions, body pointing drift.
  - **TCS (Thermal Control)**: Multi-node thermistor telemetry (Bus electronics, Battery pack, Radiator panels, Earth-facing payload deck).
  - **COMMS (Communications)**: S-Band telemetry downlink, X-Band payload transmission, doppler shift correction, signal-to-noise ratio.
  - **PROP (Propulsion / Maneuver)**: Cold gas / monopropellant isolation valves, tank pressures, total impulse.

### 2. Multi-Agent Swarm Intelligence & Raft Consensus
- **Agent Alpha (Anomaly Detection)**: Evaluates high-frequency sensor streams against dynamic statistical baseline envelopes.
- **Agent Beta (Flight Dynamics)**: Computes orbital decay, beta angle precession, and propellantless attitude compensation vectors.
- **Agent Gamma (Safety Interlock Enforcement)**: Validates command payloads against hard satellite mission constraints (`SR-PWR-*`, `SR-ADCS-*`, `SR-PROP-*`).
- **Agent Delta (Supervisor / Consensus Leader)**: Coordinates multi-agent votes into a Byzantine-fault-tolerant Raft quorum (4/4 node sign-off required for autonomous execution).

### 3. Propellantless Trajectory Correction Laboratory
- **Aerotrim Dynamic Drag**: Variable frontal cross-section modulation in the thermosphere ($F_{\text{drag}} = \frac{1}{2} \rho v^2 C_d A$) to trim orbital phasing and altitude without expending propellant.
- **Electrodynamic Bare Tether (Lorentz Force)**: Conductive tether moving through Earth's magnetic field ($F = I \cdot (\vec{L} \times \vec{B})$) for propellantless orbit raising or de-orbiting.
- **Solar Radiation Pressure (Photon Sailing)**: Solar panel tilt angle modulation against solar photon flux ($P_{\text{rad}} \approx 4.56 \times 10^{-6} \text{ N/m}^2$) for sun-synchronous drift correction.

### 4. OrbitGuard Hybrid Interlock Verification
Direct integration with the OrbitGuard hardware-in-the-loop and software verification suite:
- **Constraint 1**: Thermal Mode Payload Interlock (prevents high-power payload operation during thermal safe modes).
- **Constraint 2**: ADCS Wheel Stability Interlock (enforces momentum storage limits $< 0.12 \text{ N}\cdot\text{m}\cdot\text{s}$ to prevent saturation).
- **Constraint 3**: Battery SoC Safety Margin (verifies energy reserves exceed critical minimums during orbital night).
- **Check 4**: Contingency Rollback Definition (mandates deterministic, subsystem-mapped rollback procedures with 100% reversible step handlers).

### 5. Google Gemini AI Autonomous Reasoning & Multi-Model Cascade
- Sub-second diagnostic root-cause synthesis with adaptive multi-model failover:
  1. `gemini-3.1-flash-lite` (Primary high-availability reasoning tier)
  2. `gemini-flash-latest` (Secondary fast diagnostic tier)
  3. `gemini-3.8-flash` (Deep flight operations analysis tier)
- Natural-language flight supervisor REPL command parsing and autonomous runbook generation.

### 6. Relational Aerospace Database
- 17 structured PostgreSQL schemas encompassing:
  - Fleet Registry (`satellites`, `subsystems`, `operating_modes`)
  - Telemetry & Sensor Timeseries (`telemetry`, `telemetry_baselines`)
  - Incident Response & FDIR (`anomalies`, `incidents`, `agent_runs`, `recovery_plans`, `validations`, `command_executions`)
  - Knowledge Base & Safety Matrix (`action_catalog`, `safety_rules`, `historical_incidents`, `runbook_templates`, `system_config`)
  - Compliance Ledger (`audit_events`)

---

## Directory Structure

```
.
├── database/                   # PostgreSQL schema, migrations, and seed scripts
│   ├── migrations/             # Incremental DDL migrations (001-004)
│   ├── seed/                   # Aerospace constellation, telemetry, and runbook seeds
│   ├── reset_demo.sql          # Idempotent demo reset procedure
│   ├── schema.sql              # Consolidated schema definition
│   └── README.md               # Database architecture specifications
├── public/                     # Static flight assets and icons
├── src/                        # React frontend source code
│   ├── components/             # Subsystem visualizers, 3D Globe, Chaos Lab, REPL
│   ├── services/               # OrbitGuard API and Gemini telemetry clients
│   ├── App.tsx                 # Main mission control layout & router
│   ├── main.tsx                # Client entry point
│   ├── index.css               # Global Tailwind CSS styles
│   └── types.ts                # TypeScript aerospace telemetry interfaces
├── .env.example                # Template environment variables
├── .gitignore                  # Git exclusions for production builds and secrets
├── index.html                  # HTML entry point with metadata tags
├── metadata.json               # Google AI Studio app configuration
├── package.json                # Project dependencies and script declarations
├── server.ts                   # Express server, Vite middleware & AI proxy
├── tsconfig.json               # TypeScript strict compiler configuration
├── verify_database.py          # Python database schema & contract test suite
└── vite.config.ts              # Vite bundler & Tailwind plugin configuration
```

---

## Quick Start

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Python 3**: For database schema validation (`python3 verify_database.py`)

### 1. Installation
Clone the repository and install npm dependencies:
```bash
git clone https://github.com/your-username/orion7-satellite-digital-twin.git
cd orion7-satellite-digital-twin
npm install
```

### 2. Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```
Fill in the necessary keys (e.g. `GEMINI_API_KEY`, `ORBITGUARD_API_URL`, `DATABASE_URL`).
*Note: In Google AI Studio, `GEMINI_API_KEY` is automatically injected into the container environment.*

### 3. Launch Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000` to interact with the mission control console.

### 4. Build for Production
```bash
npm run build
npm start
```
The application compiles client assets with Vite and bundles the Express server into `dist/server.cjs` via `esbuild`.

---

## Testing & Verification

### Database Schema & AI Contract Verification
Verify all 17 database tables, indexes, seed records, and AI JSON contracts:
```bash
npm run test:db
# or directly:
python3 verify_database.py
```

### TypeScript Lint & Type Checking
```bash
npm run lint
```

---

## API Endpoints

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/health` | `GET` | Health check, server uptime, and external service configuration |
| `/api/telemetry` | `GET` | Current high-rate satellite telemetry snapshot |
| `/api/fleet` | `GET` | Constellation satellites status and operating modes |
| `/api/ai/diagnose` | `POST` | Hybrid OrbitGuard validation + Gemini root-cause diagnosis |
| `/api/ai/chat` | `POST` | Natural-language Flight Supervisor REPL query interface |
| `/api/orbitguard/health` | `GET` | Upstream OrbitGuard service connectivity check |
| `/api/orbitguard/simulate/inject` | `POST` | Injects controlled hardware faults into OrbitGuard simulator |
| `/api/orbitguard/simulate/reset` | `POST` | Restores spacecraft digital twin to nominal baseline |
| `/api/orbitguard/plans/validate` | `POST` | Validates recovery plan against aerospace safety interlocks |

---

## Aerospace Safety Interlocks

| Rule ID | Subsystem | Invariant Description | Threshold / Constraint |
| :--- | :---: | :--- | :--- |
| `SR-PWR-01` | EPS | Minimum Battery Reserve | SoC $\ge 40.0\%$ during payload operations |
| `SR-PWR-02` | EPS | Maximum Cell Temperature | Battery temperature $\le 35.0^\circ\text{C}$ |
| `SR-ADCS-01` | ADCS | Maximum Momentum Storage | Wheel angular momentum $< 0.12 \text{ N}\cdot\text{m}\cdot\text{s}$ |
| `SR-ADCS-02` | ADCS | Maximum Body Slew Rate | Slew rate $\le 1.5^\circ/\text{s}$ during payload exposure |
| `SR-TCS-01` | TCS | Radiator Thermal Shading | Radiator temperature $\le -10.0^\circ\text{C}$ to ensure heat sink |
| `SR-PROP-01` | PROP | Manifold Overpressure | Thruster manifold pressure $\le 3.8 \text{ bar}$ |
| `SR-COMMS-01`| COMMS | RF High Power In Eclipse | RF transmit power throttled to $\le 15 \text{ W}$ during umbra |

---

## Intellectual Property & Licensing

**Proprietary and Confidential — Patent Pending / All Rights Reserved.**

- **Competition / Program**: Smart Horizon 48-Hour Hackathon
- **Team Registration Number**: 098
- **Topic Designation**: DST-1
- **Inventors & Principal Authors**:
  1. **L Steven Dylan**
  2. **Karan Sai S**
  3. **Kemisetti Hemachandra**
  4. **Jeevan M**
  5. **Jyotiraditya Pradip Khuman**

Copyright © 2026 Team 098 (L Steven Dylan, Karan Sai S, Kemisetti Hemachandra, Jeevan M, Jyotiraditya Pradip Khuman). All rights reserved.

No license, express or implied, is granted for public redistribution, modification, commercial use, or reverse engineering of the proprietary algorithms, orbital mechanics control models, digital twin architectures, or safety interlock state machines.
