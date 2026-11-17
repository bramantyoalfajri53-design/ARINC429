"""Runtime configuration for the ATE Power web HMI."""

from __future__ import annotations

import hashlib
import os
import secrets
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
ENV_FILE = PROJECT_ROOT / ".env"

DC_HV_THRESHOLD_V = 35.0
AC_HV_THRESHOLD_VRMS = 130.0
LEASE_TIMEOUT_S = 15.0
TELEMETRY_HZ = 10.0
SESSION_COOKIE = "ate_hmi_session"
DEFAULT_BIND_HOST = "0.0.0.0"
DEFAULT_BIND_PORT = 8080


def _load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        os.environ.setdefault(key, value)


_load_dotenv(ENV_FILE)


def _pbkdf2_hash(pin: str, salt_hex: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256",
        pin.encode("utf-8"),
        bytes.fromhex(salt_hex),
        120_000,
    ).hex()


def pin_hash_from_env() -> tuple[str, str]:
    """Return (salt_hex, digest_hex) for the operator PIN."""
    stored = os.environ.get("ATE_HMI_PIN_HASH", "").strip()
    if stored and ":" in stored:
        salt_hex, digest = stored.split(":", 1)
        return salt_hex, digest

    pin = os.environ.get("ATE_HMI_PIN", "2468")
    salt_hex = os.environ.get("ATE_HMI_PIN_SALT", "a1b2c3d4e5f60718293a4b5c6d7e8f90")
    return salt_hex, _pbkdf2_hash(pin, salt_hex)


def verify_pin(candidate: str) -> bool:
    salt_hex, expected = pin_hash_from_env()
    actual = _pbkdf2_hash(candidate, salt_hex)
    return secrets.compare_digest(actual, expected)


def session_secret() -> str:
    secret = os.environ.get("ATE_HMI_SESSION_SECRET", "").strip()
    if secret:
        return secret
    generated = secrets.token_hex(32)
    os.environ["ATE_HMI_SESSION_SECRET"] = generated
    return generated


FRONTEND_DIST = PROJECT_ROOT / "hmi" / "frontend" / "dist"

DEFAULT_DC_VISA = "GPIB0::5::INSTR"
DEFAULT_AC_VISA = "GPIB0::7::INSTR"


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


# LXI (LAN) first. Full VISA strings override hosts when set.
DC_LXI_HOST = _env("ATE_DC_LXI_HOST")
AC_LXI_HOST = _env("ATE_AC_LXI_HOST")
DC_VISA_RESOURCE = _env("ATE_DC_VISA")
AC_VISA_RESOURCE = _env("ATE_AC_VISA")
