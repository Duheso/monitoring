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
    """Authenticate a Linux user via /etc/shadow + crypt (no root required, user must be in shadow group)."""
    try:
        import crypt
        import pwd

        # Verify user exists
        try:
            pwd.getpwnam(username)
        except KeyError:
            logger.warning('Auth denied - user %s does not exist', username)
            return False

        # Get password hash from shadow
        shadow_hash = None
        try:
            with open('/etc/shadow') as f:
                for line in f:
                    if line.startswith(username + ':'):
                        shadow_hash = line.split(':')[1]
                        break
        except PermissionError:
            logger.error('Cannot read /etc/shadow - running user not in shadow group')
            return False

        if not shadow_hash or shadow_hash in ('*', '!', '!!', ''):
            logger.warning('Auth denied - no valid password hash for %s', username)
            return False

        # Verify password
        hashed = crypt.crypt(password, shadow_hash)
        success = hashed == shadow_hash
        if not success:
            logger.warning('Auth failed for %s - invalid password', username)
        return success
    except Exception:
        logger.exception('Auth error for %s', username)
        return False
