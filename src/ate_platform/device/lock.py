"""Exclusive write lock for station instrument control."""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass
from typing import Optional


@dataclass
class LockState:
    holder: Optional[str] = None
    label: str = ""
    acquired_at: float = 0.0


class ControlLock:
    """Only one client may issue setpoints/output ON. E-STOP bypasses this."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._state = LockState()

    def acquire(self, label: str = "client") -> str:
        with self._lock:
            if self._state.holder:
                raise RuntimeError(
                    f"Control lock held by {self._state.label!r} ({self._state.holder})"
                )
            token = uuid.uuid4().hex
            self._state = LockState(holder=token, label=label, acquired_at=time.time())
            return token

    def release(self, token: str) -> None:
        with self._lock:
            if self._state.holder == token:
                self._state = LockState()

    def require(self, token: Optional[str]) -> None:
        with self._lock:
            if not self._state.holder:
                raise RuntimeError("No control lock held; acquire first")
            if token != self._state.holder:
                raise RuntimeError("Invalid control lock token")

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "held": bool(self._state.holder),
                "label": self._state.label if self._state.holder else "",
                "age_s": round(time.time() - self._state.acquired_at, 1)
                if self._state.holder
                else 0.0,
            }
