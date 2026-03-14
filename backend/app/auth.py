"""Authentication utilities — PAM + JWT for DGX Monitor."""
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from jose import jwt, JWTError

# ── Secret key (persisted across restarts) ────────────────────────────────────
_base = Path(__file__).resolve().parents[2] / 'backend_data'

def _load_secret() -> str:
    try:
        _base.mkdir(parents=True, exist_ok=True)
        f = _base / '.jwt_secret'
        if f.exists():
            return f.read_text().strip()
        key = secrets.token_hex(32)
        f.write_text(key)
        f.chmod(0o600)
        return key
    except Exception:
        return secrets.token_hex(32)

SECRET_KEY     = _load_secret()
ALGORITHM      = 'HS256'
TOKEN_EXPIRE_H = 8


def create_access_token(username: str) -> str:
    now = datetime.utcnow()
    payload = {
        'sub': username,
        'iat': now,
        'exp': now + timedelta(hours=TOKEN_EXPIRE_H),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[str]:
    """Return username if the JWT is valid and unexpired, else None."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get('sub')
    except JWTError:
        return None


def authenticate_pam(username: str, password: str) -> bool:
    """Authenticate a Linux user via PAM (uses unix_chkpwd, no root required)."""
    try:
        import pam
        return pam.pam().authenticate(username, password)
    except Exception as exc:
        import logging
        logging.getLogger('monitor').warning('PAM auth error: %s', exc)
        return False
