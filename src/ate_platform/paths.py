"""Paths and environment helpers for the station kernel."""

from __future__ import annotations

import os
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = PACKAGE_ROOT


def load_dotenv(path: Path | None = None) -> None:
    env_path = path or (REPO_ROOT / ".env")
    if not env_path.is_file():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'").strip('"'))


def force_simulation() -> bool:
    return os.environ.get("ATE_FORCE_SIM", "").strip().lower() in {"1", "true", "yes", "on"}


def env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()
