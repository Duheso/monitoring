"""Authentication utilities — PAM + JWT for DGX Monitor."""
import logging
import os
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from jose import JWTError, jwt

# Load .env from project root (two levels above this file: backend/app/ → root)
_project_root = Path(__file__).resolve().parents[2]
load_dotenv(_project_root / '.env')

logger = logging.getLogger('monitor')

# ── Secret key ────────────────────────────────────────────────────────────────
# Priority: SECRET_KEY env var → ephemeral random (tokens die on restart)
def _load_secret() -> str:
    key = os.getenv('SECRET_KEY', '').strip()
    if key:
        return key
    logger.warning(
        'SECRET_KEY not set in .env — generating ephemeral key. '
        'All sessions will be invalidated on restart. '
        'Set SECRET_KEY in .env for persistent sessions.'
    )
    return secrets.token_hex(32)

SECRET_KEY     = _load_secret()
ALGORITHM      = 'HS256'
TOKEN_EXPIRE_H = int(os.getenv('JWT_EXPIRE_HOURS', '8'))


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
