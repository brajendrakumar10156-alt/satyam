import hashlib
import hmac
import os
import re
import secrets
import smtplib
import ssl
import time
from email.message import EmailMessage
from typing import Any, Dict, Optional

import requests


def _load_env() -> None:
    base = os.path.dirname(os.path.abspath(__file__))
    for name in ('.env', '../.env'):
        path = os.path.join(base, name)
        if not os.path.isfile(path):
            continue
        with open(path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, val = line.split('=', 1)
                os.environ.setdefault(key.strip(), val.strip().strip('"\''))


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {'1', 'true', 'yes', 'on'}


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


_load_env()

OTP_TTL_SECONDS = _env_int('OTP_TTL_SECONDS', 600)
OTP_RESEND_COOLDOWN_SECONDS = _env_int('OTP_RESEND_COOLDOWN_SECONDS', 60)
OTP_REQUEST_LIMIT = _env_int('OTP_REQUEST_LIMIT', 5)
OTP_REQUEST_WINDOW_SECONDS = _env_int('OTP_REQUEST_WINDOW_SECONDS', 3600)
OTP_MAX_ATTEMPTS = _env_int('OTP_MAX_ATTEMPTS', 5)
ACCESS_TOKEN_TTL_SECONDS = _env_int('ACCESS_TOKEN_TTL_SECONDS', 86400)
AUTH_REQUIRE_GMAIL = _env_bool('AUTH_REQUIRE_GMAIL', True)
AUTH_DEV_PRINT_OTP = _env_bool('AUTH_DEV_PRINT_OTP', True)
AUTH_FORCE_CONSOLE_OTP = _env_bool('AUTH_FORCE_CONSOLE_OTP', False)
OTP_PEPPER = os.getenv('AUTH_OTP_PEPPER') or secrets.token_urlsafe(32)

EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')

_sessions: Dict[str, Dict[str, Any]] = {}
_tokens: Dict[str, Dict[str, Any]] = {}
_request_log: Dict[str, list[float]] = {}

# Persistent JSON Password Database File Path
_USERS_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'users_db.json')
_OTP_LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'otp_log.txt')

def _load_users_db() -> Dict[str, Dict[str, Any]]:
    if os.path.exists(_USERS_DB_PATH):
        try:
            import json
            with open(_USERS_DB_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def _save_users_db(users_dict: Dict[str, Dict[str, Any]]) -> None:
    try:
        import json
        with open(_USERS_DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(users_dict, f, indent=2)
    except Exception as e:
        print(f"[AuthStore] Failed to save users_db.json: {e}")

def _log_otp_event(email: str, otp: str, event_type: str = "REQUEST") -> None:
    try:
        from datetime import datetime
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")
        log_line = f"[{now_str}] Event: {event_type} | Email: {email} | OTP: {otp}\n"
        with open(_OTP_LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(log_line)
    except Exception as e:
        print(f"[AuthStore] Failed to write to otp_log.txt: {e}")

_users_passwords: Dict[str, Dict[str, Any]] = _load_users_db()

class AuthError(ValueError):
    pass


def _hash_password(password: str) -> str:
    # Simple in-memory password hashing (salted).
    salt = os.getenv('AUTH_PASSWORD_SALT') or 'dev_salt'
    payload = f'{salt}:{password}'.encode('utf-8')
    return hashlib.sha256(payload).hexdigest()


def _normalize_password(password: str) -> str:
    p = str(password or '')
    if len(p.strip()) < 8:
        raise AuthError('Password must be at least 8 characters')
    return p.strip()


def _now() -> float:
    return time.time()


def _cleanup(now: Optional[float] = None) -> None:
    current = now or _now()
    for session_id, session in list(_sessions.items()):
        if session.get('expires_at', 0) < current and not session.get('verified'):
            _sessions.pop(session_id, None)
    for token, data in list(_tokens.items()):
        if data.get('expires_at', 0) < current:
            _tokens.pop(token, None)
    for identifier, entries in list(_request_log.items()):
        recent = [t for t in entries if current - t < OTP_REQUEST_WINDOW_SECONDS]
        if recent:
            _request_log[identifier] = recent
        else:
            _request_log.pop(identifier, None)


def normalize_email(email: str) -> str:
    value = str(email or '').strip().lower()
    if not EMAIL_RE.match(value):
        raise AuthError('Enter a valid Gmail address')
    if AUTH_REQUIRE_GMAIL and not (value.endswith('@gmail.com') or value.endswith('@googlemail.com')):
        raise AuthError('Only Gmail addresses are allowed for login')
    return value


def _mask_email(email: str) -> str:
    name, domain = email.split('@', 1)
    if len(name) <= 2:
        masked_name = name[0] + '*'
    else:
        masked_name = f'{name[0]}{"*" * (len(name) - 2)}{name[-1]}'
    return f'{masked_name}@{domain}'


def _hash_otp(session_id: str, otp: str) -> str:
    payload = f'{session_id}:{otp}:{OTP_PEPPER}'.encode('utf-8')
    return hashlib.sha256(payload).hexdigest()


def _generate_otp() -> str:
    return f'{secrets.randbelow(1_000_000):06d}'


def _check_rate_limit(identifier: str, now: float) -> None:
    recent = [t for t in _request_log.get(identifier, []) if now - t < OTP_REQUEST_WINDOW_SECONDS]
    if recent and now - recent[-1] < OTP_RESEND_COOLDOWN_SECONDS:
        wait = int(OTP_RESEND_COOLDOWN_SECONDS - (now - recent[-1])) + 1
        raise AuthError(f'Please wait {wait}s before requesting another OTP')
    if len(recent) >= OTP_REQUEST_LIMIT:
        raise AuthError('Too many OTP requests. Try again later')
    recent.append(now)
    _request_log[identifier] = recent


def _smtp_config() -> Optional[Dict[str, Any]]:
    username = (
        os.getenv('SMTP_USERNAME')
        or os.getenv('GMAIL_USER')
        or os.getenv('GMAIL_SMTP_USER')
    )
    password = (
        os.getenv('SMTP_PASSWORD')
        or os.getenv('GMAIL_APP_PASSWORD')
        or os.getenv('GMAIL_SMTP_PASSWORD')
    )
    if not username or not password:
        return None
    port = _env_int('SMTP_PORT', 587)
    return {
        'host': os.getenv('SMTP_HOST', 'smtp.gmail.com'),
        'port': port,
        'username': username,
        'password': password,
        'sender': os.getenv('SMTP_FROM') or username,
        'use_ssl': _env_bool('SMTP_USE_SSL', port == 465),
        'starttls': _env_bool('SMTP_STARTTLS', port != 465),
    }


def _send_email_otp(email: str, otp: str) -> Dict[str, str]:
    config = _smtp_config()
    if not config:
        raise AuthError('SMTP is not configured')

    msg = EmailMessage()
    msg['Subject'] = 'QuantaAI login OTP'
    msg['From'] = config['sender']
    msg['To'] = email
    msg.set_content(
        f'Your QuantaAI login OTP is {otp}.\n\n'
        f'This code expires in {OTP_TTL_SECONDS // 60} minutes.\n'
        'If you did not request this login, ignore this email.'
    )

    if config['use_ssl']:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(config['host'], config['port'], context=context, timeout=15) as server:
            server.login(config['username'], config['password'])
            server.send_message(msg)
    else:
        with smtplib.SMTP(config['host'], config['port'], timeout=15) as server:
            if config['starttls']:
                server.starttls(context=ssl.create_default_context())
            server.login(config['username'], config['password'])
            server.send_message(msg)

    return {'channel': 'gmail_smtp', 'target': _mask_email(email)}


def _send_telegram_otp(email: str, otp: str) -> Dict[str, str]:
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
    chat_id = os.getenv('TELEGRAM_CHAT_ID')
    if not bot_token or not chat_id:
        raise AuthError('Telegram is not configured')

    message = (
        f'QuantaAI login OTP\n'
        f'Email: {email}\n'
        f'OTP: {otp}\n'
        f'Expires in: {OTP_TTL_SECONDS // 60} minutes'
    )
    resp = requests.post(
        f'https://api.telegram.org/bot{bot_token}/sendMessage',
        json={'chat_id': chat_id, 'text': message},
        timeout=15,
    )
    data = resp.json()
    if not resp.ok or not data.get('ok'):
        description = data.get('description') if isinstance(data, dict) else resp.text
        raise AuthError(f'Telegram send failed: {description}')
    return {'channel': 'telegram', 'target': 'configured chat'}


def _write_otp_to_file(email: str, otp: str) -> None:
    """Write OTP to a file for the watcher terminal to read and log to otp_log.txt."""
    try:
        otp_file = os.path.join(os.path.dirname(__file__), '.otp_current.txt')
        with open(otp_file, 'w') as f:
            f.write(f'{email}|{otp}|{int(time.time())}')
        _log_otp_event(email, otp, "REQUEST")
    except Exception:
        pass  # Silent fail - not critical


def _deliver_otp(email: str, otp: str) -> Dict[str, str]:
    errors = []
    # Write to file for watcher terminal
    _write_otp_to_file(email, otp)
    
    if AUTH_FORCE_CONSOLE_OTP and AUTH_DEV_PRINT_OTP:
        print(f'\n{"="*60}', flush=True)
        print(f'🔐 OTP FOR LOGIN 🔐', flush=True)
        print(f'Email: {email}', flush=True)
        print(f'OTP: {otp}', flush=True)
        print(f'{"="*60}\n', flush=True)
        return {'channel': 'backend_console', 'target': 'backend terminal'}

    if _smtp_config():
        try:
            return _send_email_otp(email, otp)
        except Exception as exc:
            errors.append(f'email: {exc}')

    if os.getenv('TELEGRAM_BOT_TOKEN') and os.getenv('TELEGRAM_CHAT_ID'):
        try:
            return _send_telegram_otp(email, otp)
        except Exception as exc:
            errors.append(f'telegram: {exc}')

    if AUTH_DEV_PRINT_OTP:
        print(f'\n{"="*60}', flush=True)
        print(f'🔐 OTP FOR LOGIN 🔐', flush=True)
        print(f'Email: {email}', flush=True)
        print(f'OTP: {otp}', flush=True)
        print(f'{"="*60}\n', flush=True)
        return {'channel': 'backend_console', 'target': 'backend terminal'}

    detail = '; '.join(errors) if errors else 'no delivery provider configured'
    raise AuthError(f'OTP delivery failed ({detail})')


def create_session(email: str) -> Dict[str, Any]:
    now = _now()
    _cleanup(now)
    identifier = normalize_email(email)
    _check_rate_limit(identifier, now)

    session_id = secrets.token_urlsafe(24)
    otp = _generate_otp()
    delivery = _deliver_otp(identifier, otp)

    _sessions[session_id] = {
        'identifier': identifier,
        'otp_hash': _hash_otp(session_id, otp),
        'created_at': now,
        'expires_at': now + OTP_TTL_SECONDS,
        'attempts': 0,
        'verified': False,
    }
    return {
        'sessionId': session_id,
        'delivery': delivery,
        'expiresIn': OTP_TTL_SECONDS,
    }


def verify_otp(session_id: str, otp: str) -> Dict[str, Any]:
    now = _now()
    _cleanup(now)
    sid = str(session_id or '').strip()
    code = str(otp or '').strip()
    session = _sessions.get(sid)
    if not session:
        raise AuthError('OTP session is invalid or expired')

    if session.get('expires_at', 0) < now:
        _sessions.pop(sid, None)
        raise AuthError('OTP expired. Request a new code')

    if session.get('verified'):
        token = session.get('access_token')
        cached = _tokens.get(token or '')
        if cached:
            return cached
        raise AuthError('Session already used. Login again')

    if session.get('attempts', 0) >= OTP_MAX_ATTEMPTS:
        raise AuthError('Too many wrong OTP attempts. Request a new code')

    expected_hash = session.get('otp_hash', '')
    provided_hash = _hash_otp(sid, code)
    if not hmac.compare_digest(expected_hash, provided_hash):
        session['attempts'] = session.get('attempts', 0) + 1
        remaining = max(OTP_MAX_ATTEMPTS - session['attempts'], 0)
        if remaining == 0:
            raise AuthError('Too many wrong OTP attempts. Request a new code')
        raise AuthError(f'Invalid OTP. {remaining} attempts left')

    session['verified'] = True
    access_token = secrets.token_urlsafe(48)
    user = {
        'id': hashlib.sha256(session['identifier'].encode('utf-8')).hexdigest()[:16],
        'identifier': session['identifier'],
        'method': 'gmail_otp',
    }
    _tokens[access_token] = {
        'accessToken': access_token,
        'user': user,
        'sessionId': sid,
        'created_at': now,
        'expires_at': now + ACCESS_TOKEN_TTL_SECONDS,
    }
    session['access_token'] = access_token
    return _tokens[access_token]


def get_user_by_token(access_token: str) -> Optional[Dict[str, Any]]:
    now = _now()
    _cleanup(now)
    token = str(access_token or '').strip()
    data = _tokens.get(token)
    if not data:
        return None
    if data.get('expires_at', 0) < now:
        _tokens.pop(token, None)
        return None
    return data.get('user')


def _get_user_identifier(email: str) -> str:
    identifier = normalize_email(email)
    return identifier


def signup_with_password(email: str, password: str) -> Dict[str, Any]:
    """Create password for user and persist to users_db.json. Returns new access token."""
    identifier = _get_user_identifier(email)
    pw = _normalize_password(password)
    if identifier in _users_passwords:
        raise AuthError('Account already exists. Please login.')
    _users_passwords[identifier] = {
        'password_hash': _hash_password(pw),
        'created_at': _now(),
    }
    _save_users_db(_users_passwords)

    # issue token
    user = {
        'id': hashlib.sha256(identifier.encode('utf-8')).hexdigest()[:16],
        'identifier': identifier,
        'method': 'password',
    }
    access_token = secrets.token_urlsafe(48)
    _tokens[access_token] = {
        'accessToken': access_token,
        'user': user,
        'created_at': _now(),
        'expires_at': _now() + ACCESS_TOKEN_TTL_SECONDS,
    }
    return _tokens[access_token]


def verify_password_and_issue_token(email: str, password: str) -> Dict[str, Any]:
    """Validate password (in-memory) and return access token."""
    identifier = _get_user_identifier(email)
    pw = _normalize_password(password)

    rec = _users_passwords.get(identifier)
    if not rec:
        raise AuthError('Account not found. Please sign up.')
    expected = rec.get('password_hash')
    provided = _hash_password(pw)
    if not expected or not hmac.compare_digest(expected, provided):
        raise AuthError('Invalid password')

    user = {
        'id': hashlib.sha256(identifier.encode('utf-8')).hexdigest()[:16],
        'identifier': identifier,
        'method': 'password',
    }
    access_token = secrets.token_urlsafe(48)
    _tokens[access_token] = {
        'accessToken': access_token,
        'user': user,
        'created_at': _now(),
        'expires_at': _now() + ACCESS_TOKEN_TTL_SECONDS,
    }
    return _tokens[access_token]


def reset_password_with_verified_otp(session_id: str, otp: str, email: str, new_password: str) -> None:
    """
    OTP already verified by verify_otp() will set session['verified'].
    This function resets password for the same email/identifier.
    """
    identifier = _get_user_identifier(email)
    # verify OTP first; this will raise if invalid/expired
    verify_otp(session_id, otp)

    pw = _normalize_password(new_password)
    _users_passwords[identifier] = {
        'password_hash': _hash_password(pw),
        'created_at': _users_passwords.get(identifier, {}).get('created_at', _now()),
    }
