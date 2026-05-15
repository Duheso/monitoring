"""Shared configuration — data directory, auth dependency.
Imported by main.py and sub-modules to avoid circular imports.
"""
import os
from pathlib import Path
from typing import Optional
from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .auth import verify_token

# ── Project root ──────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# ── Runtime data directory ────────────────────────────────────────────────────
def _resolve_data_dir() -> Path:
    env_dir = os.getenv('DATA_DIR', '').strip()
    if env_dir:
        p = Path(env_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p
    candidates = [
        PROJECT_ROOT / 'backend_data',
        Path('/var/lib/dgx-monitor'),
        Path('/tmp/dgx-monitor'),
    ]
    for p in candidates:
        try:
            p.mkdir(parents=True, exist_ok=True)
            return p
        except PermissionError:
            continue
    raise RuntimeError('Cannot create a writable data directory')

data_dir = _resolve_data_dir()
layouts_dir = data_dir / 'layouts'
layouts_dir.mkdir(exist_ok=True)
services_file = data_dir / 'services.json'

# ── Auth dependency ───────────────────────────────────────────────────────────
_bearer = HTTPBearer(auto_error=False)

async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    token: Optional[str] = Query(default=None),
) -> str:
    raw = (creds.credentials if creds else None) or token or ''
    user = verify_token(raw)
    if not user:
        raise HTTPException(status_code=401, detail='Invalid or expired token')
    return user
