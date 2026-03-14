# Backend (FastAPI)

Setup and run (from project root):

1. Create venv and install requirements

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

2. Run the server (development)

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 3001 --reload
```

This exposes a WebSocket at `ws://<host>:3001/ws` which streams JSON metrics every second.
