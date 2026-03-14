# DGX Monitor

Minimal scaffold: backend (FastAPI) serving metrics via WebSocket on port 3001 and frontend (Vite + React) UI.

Quick start

1. Backend

```bash
cd /home/accadmin/workspace/monitoring
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 3001 --reload
```

2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend connects to `ws://<host>:3001/ws` to receive live metrics every 1s.

Build static frontend and serve via backend

```bash
cd frontend
npm install
npm run build
# then start backend (from project root venv)
uvicorn backend.app.main:app --host 0.0.0.0 --port 3001
```

Systemd service (optional)

The repository includes an example systemd unit at `deployment/monitoring.service` and an install script `scripts/install_service.sh`.
To install the service run (requires root):

```bash
sudo bash scripts/install_service.sh
```

Server-side layout persistence

The backend exposes a simple per-user layout API to persist dashboard layouts:

- GET `/api/layout?user=<name>` returns a JSON `{ "layout": [...] }` or `{ "layout": null }` if none saved.
- POST `/api/layout?user=<name>` with body `{ "layout": [...] }` saves the layout for that user.

The server stores layouts under an internal data directory. If the service user cannot write the project directory the server will fall back to `/var/lib/dgx-monitor` or `/tmp/dgx-monitor`.


