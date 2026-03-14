# DGX Monitor

> **Professional real-time monitoring dashboard for NVIDIA DGX servers**  
> Built with FastAPI · React · WebSocket · PAM authentication

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.95-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

DGX Monitor is a self-hosted, production-grade monitoring dashboard inspired by Grafana and Dynatrace. It provides real-time visibility into every layer of an NVIDIA DGX A100 server — GPUs, CPU, memory, storage, network, processes, systemd services, and live journal logs — all in a fully customizable, multi-user web interface.

Each user authenticates with their **Linux system account** and builds their own persistent dashboard layout. No external database or identity provider required.

---

## Features

### Dashboard & UI
- **Drag-and-drop** card layout — resize and reposition any card freely
- **Add / remove cards** at runtime without reloading
- **10 built-in themes** — Ocean, Midnight, Sunset, Forest, Matrix, Slate, Warm, Violet, Solar, Cool
- **10 font options** — Inter, Roboto, Poppins, JetBrains Mono, and more
- Per-user layouts saved server-side; your dashboard follows you across browsers

### Monitoring Cards

| Card | Metrics |
|------|---------|
| **GPU (All)** | Utilization %, memory used/total, temperature, power draw, fan speed, clock speeds — per-GPU tiles with custom names |
| **Single GPU** | Dedicated card per GPU index with all metrics and individual controls |
| **GPU Processes** | GPU process list with filters by GPU index, PID, and process name |
| **CPU** | Per-core utilization, frequency, load average (1/5/15 min), live sparkline |
| **Memory** | RAM and swap — used, available, total, live sparkline |
| **Disk** | Per-filesystem usage, I/O read **and** write rates with dual-line sparkline |
| **Network** | Per-interface stats, IPv4/IPv6/MAC addresses, upload/download sparklines, interface filter |
| **Processes** | Top processes by CPU/memory — PID, user, command, CPU%, MEM%, runtime |
| **System Info** | Hostname, DGX platform, OS, kernel, NVIDIA driver, CUDA version, chassis serial/part number, DGX build info |
| **Services** | Systemd service status with start/stop/restart actions; add/remove monitored services |
| **Journal** | Live `journalctl` stream per service — text filter, follow mode, pause, line-count selector, multiple simultaneous journals |

### Column Visibility
Every card has a **⚙ settings panel** to show or hide individual columns and metrics.

### Authentication & Multi-user
- Login with **Linux system credentials** (PAM — no separate user database)
- JWT sessions (8-hour lifetime, configurable)
- Each user gets an **isolated dashboard** saved on the server
- All API endpoints and WebSocket connections require a valid token

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│   React + Vite  ──→  WebSocket  /ws?token=…   (1 Hz)       │
│                  ──→  SSE       /api/journal/… (live logs)  │
│                  ──→  REST      /api/*          (CRUD)      │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP :3001
┌────────────────────────────▼────────────────────────────────┐
│                      FastAPI Backend                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Auth        │  │  Metrics         │  │  Journal SSE │  │
│  │  PAM + JWT   │  │  psutil +        │  │  journalctl  │  │
│  └──────────────┘  │  nvidia-smi      │  │  -f stream   │  │
│                    └──────────────────┘  └──────────────┘  │
│                                                             │
│   Per-user layout  →  DATA_DIR/layouts/{username}.json     │
│   Monitored svcs   →  DATA_DIR/services.json               │
└─────────────────────────────────────────────────────────────┘
```

**Backend** — Python 3.10+ · FastAPI · Uvicorn · psutil · nvidia-smi · python-pam · python-jose · python-dotenv  
**Frontend** — React 18 · Vite · react-grid-layout · recharts · lucide-react

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Ubuntu 20.04+ | Tested on DGX A100 |
| NVIDIA drivers + `nvidia-smi` | Must be in `PATH` |
| Python 3.10+ | With `pip` |
| Node.js 18+ | With `npm` |
| `libpam0g-dev` | Required to build `python-pam` |
| Service user in `shadow` group | Required for cross-user PAM auth (see below) |

---

## Installation

### 1. Clone

```bash
git clone https://github.com/Duheso/monitoring.git /opt/dgx-monitor
cd /opt/dgx-monitor
```

### 2. Install system dependency for PAM

```bash
sudo apt install libpam0g-dev
```

### 3. Backend — Python dependencies

```bash
# Use an existing venv or create one
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 4. Frontend — build

```bash
cd frontend
npm install
npm run build
cd ..
```

The compiled frontend is served automatically by FastAPI from `frontend/dist/`.

### 5. Configure environment

```bash
cp .env.example .env
chmod 600 .env
```

Edit `.env` and set `SECRET_KEY` to a strong random value:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

```ini
# .env
SECRET_KEY=<paste generated key here>
JWT_EXPIRE_HOURS=8
HOST=0.0.0.0
PORT=3001
```

### 6. Shadow group — allow cross-user PAM authentication

The backend process must be able to verify passwords for any system user.
On Ubuntu, `pam_unix.so` reads `/etc/shadow` directly when the process belongs to the `shadow` group:

```bash
sudo usermod -aG shadow <service-user>
# e.g.: sudo usermod -aG shadow accadmin
```

> **Why this is needed:** `unix_chkpwd` (setgid shadow) only allows a process to authenticate its own UID. Adding the service user to `shadow` lets `pam_unix.so` bypass `unix_chkpwd` entirely.

---

## Running

### Production — systemd (recommended)

```bash
sudo cp deployment/monitoring.service /etc/systemd/system/
# Edit the unit file to match your paths and venv location
sudo systemctl daemon-reload
sudo systemctl enable --now monitoring.service
```

Check status and live logs:

```bash
sudo systemctl status monitoring.service
sudo journalctl -u monitoring.service -f
```

### Development

**Backend** (auto-reload on code changes):

```bash
source .venv/bin/activate
uvicorn backend.app.main:app --host 0.0.0.0 --port 3001 --reload
```

**Frontend** (hot-reload dev server, proxies API to port 3001):

```bash
cd frontend
npm run dev        # http://localhost:5173
```

---

## Configuration

All settings are loaded from the `.env` file at project root (never committed — see `.env.example`).

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | *(none — ephemeral)* | JWT signing secret. Generate with `secrets.token_hex(32)`. If unset, a random key is generated per-startup and all sessions are lost on restart. |
| `JWT_EXPIRE_HOURS` | `8` | Token lifetime in hours |
| `DATA_DIR` | `./backend_data` | Directory for `services.json` and per-user layout files. Must be writable by the service user. |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `3001` | Listen port |

---

## API Reference

All endpoints except `/api/health` and `/api/auth/login` require a valid `Authorization: Bearer <token>` header.

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | ❌ | `{"status":"ok"}` — public health check |
| `/api/auth/login` | POST | ❌ | `{"username":"…","password":"…"}` → `{"access_token":"…"}` |
| `/api/auth/me` | GET | ✅ | Returns `{"username":"…"}` for the current token |
| `/ws?token=…` | WebSocket | ✅ | Live metrics broadcast at 1 Hz (token in query string) |
| `/api/history?points=N` | GET | ✅ | Last N metric snapshots (max 300, ~5 min at 1 Hz) |
| `/api/layout` | GET | ✅ | Load current user's saved layout + card instances |
| `/api/layout` | POST | ✅ | Save current user's layout + card instances |
| `/api/services` | GET | ✅ | List monitored systemd services with status |
| `/api/services` | POST | ✅ | Add a service to monitor |
| `/api/services/{name}` | DELETE | ✅ | Remove a service |
| `/api/services/{name}/action` | POST | ✅ | `{"action":"start"\|"stop"\|"restart"}` |
| `/api/journal/{service}` | GET (SSE) | ✅ | Live journal stream — `?lines=N&follow=true&token=…` |

> **WebSocket & SSE auth:** Browsers cannot set custom headers on `WebSocket` or `EventSource` connections. Both accept the token as a `?token=` query parameter.

---

## Project Structure

```
monitoring/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app — all endpoints, metrics collection, WebSocket
│   │   └── auth.py          # PAM authentication + JWT utilities
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Root — auth gate (loading → login → dashboard)
│   │   ├── main.jsx
│   │   ├── styles.css
│   │   ├── components/
│   │   │   ├── CardWrapper.jsx       # Generic card shell (header, settings menu)
│   │   │   ├── CPUCard.jsx
│   │   │   ├── DiskCard.jsx
│   │   │   ├── GPUCard.jsx           # All-GPUs overview
│   │   │   ├── GPUProcessCard.jsx    # GPU process table with filters
│   │   │   ├── Header.jsx
│   │   │   ├── JournalCard.jsx       # SSE journal stream, multiple instances
│   │   │   ├── LoginPage.jsx         # Full-screen login form
│   │   │   ├── MemCard.jsx
│   │   │   ├── MultiSparkLine.jsx    # Dual-line (read/write, up/down) sparkline
│   │   │   ├── NetworkCard.jsx
│   │   │   ├── ProcessesCard.jsx
│   │   │   ├── ServicesCard.jsx
│   │   │   ├── SingleGPUCard.jsx     # Per-GPU dedicated card
│   │   │   ├── SystemInfoCard.jsx
│   │   │   └── Toolbar.jsx           # Theme, font, add-card, user, logout
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx       # Auth state — user, token, login, logout
│   │   ├── hooks/
│   │   │   └── useWebSocket.js       # WebSocket hook with auto-reconnect + 4001 auth handling
│   │   └── lib/
│   │       └── api.js                # authFetch(), buildWsUrl(), buildTokenUrl()
│   ├── package.json
│   └── vite.config.js
├── backend_data/             # Runtime data — gitignored, created automatically
│   ├── layouts/              # Per-user dashboard layouts (JSON)
│   └── services.json         # Persisted monitored services list
├── deployment/
│   └── monitoring.service    # systemd unit file
├── .env.example              # Configuration template (commit this, never .env)
├── .gitignore
└── README.md
```

---

## Security

| Topic | Detail |
|-------|--------|
| **Passwords** | Never stored — delegated entirely to Linux PAM |
| **JWT secret** | Set in `.env` (mode `0600`), never committed |
| **Runtime data** | `backend_data/` is gitignored — layouts and service lists stay local |
| **WebSocket auth** | Invalid/missing token closes connection with code `4001` |
| **Session expiry** | Configurable via `JWT_EXPIRE_HOURS` (default 8 h) |
| **HTTPS** | Not handled by this service — **recommended:** place behind nginx or Caddy with TLS |

---

## Dependencies

### Backend

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | 0.95.2 | Web framework |
| `uvicorn[standard]` | 0.22.0 | ASGI server |
| `psutil` | 5.9.6 | CPU, memory, disk, network, process metrics |
| `aiofiles` | 23.1.0 | Async file I/O |
| `python-pam` | 2.0.2 | Linux PAM authentication |
| `python-jose[cryptography]` | 3.5.0 | JWT creation and verification |
| `python-dotenv` | 1.0.0 | `.env` file loading |

### Frontend

| Package | Purpose |
|---------|---------|
| `react` + `react-dom` | UI framework |
| `vite` + `@vitejs/plugin-react` | Build tool and dev server |
| `react-grid-layout` | Drag-and-drop resizable card grid |
| `recharts` | Sparklines and charts |
| `lucide-react` | Icon library |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Rebuild the frontend if you changed anything in `frontend/src/`: `cd frontend && npm run build`
5. Test that the backend starts cleanly: `uvicorn backend.app.main:app --reload`
6. Submit a pull request

---

## License

MIT License — see [LICENSE](LICENSE) for details.



