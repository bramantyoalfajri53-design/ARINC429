"""Control-session lease: only one browser may command instruments."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Optional

from ate_power.config import LEASE_TIMEOUT_S


@dataclass
class LeaseState:
    session_id: Optional[str] = None
    acquired_at: float = 0.0
    last_heartbeat: float = 0.0

    def snapshot(self, now: Optional[float] = None) -> dict:
        now = now or time.time()
        held = bool(self.session_id) and (now - self.last_heartbeat) <= LEASE_TIMEOUT_S
        return {
            "held": held,
            "session_id": self.session_id if held else None,
            "age_s": round(now - self.acquired_at, 1) if held else 0.0,
        }


class ControlLease:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state = LeaseState()

    def _expire_unlocked(self, now: float) -> None:
        if self._state.session_id and (now - self._state.last_heartbeat) > LEASE_TIMEOUT_S:
            self._state = LeaseState()

    def acquire(self, session_id: str) -> tuple[bool, str]:
        now = time.time()
        with self._lock:
            self._expire_unlocked(now)
            if self._state.session_id and self._state.session_id != session_id:
                return False, "Control lease is held by another operator"
            self._state.session_id = session_id
            if self._state.acquired_at == 0.0:
                self._state.acquired_at = now
            self._state.last_heartbeat = now
            return True, "Control acquired"

    def heartbeat(self, session_id: str) -> bool:
        now = time.time()
        with self._lock:
            self._expire_unlocked(now)
            if self._state.session_id != session_id:
                return False
            self._state.last_heartbeat = now
            return True

    def release(self, session_id: str) -> None:
        with self._lock:
            if self._state.session_id == session_id:
                self._state = LeaseState()

    def release_if_holder(self, session_id: str) -> None:
        self.release(session_id)

    def is_holder(self, session_id: str) -> bool:
        now = time.time()
        with self._lock:
            self._expire_unlocked(now)
            return self._state.session_id == session_id

    def snapshot(self, viewer_session_id: Optional[str] = None) -> dict:
        now = time.time()
        with self._lock:
            self._expire_unlocked(now)
            data = self._state.snapshot(now)
        data["you_control"] = bool(
            viewer_session_id and data["held"] and data["session_id"] == viewer_session_id
        )
        # Do not leak raw session ids to other browsers
        if not data["you_control"]:
            data["session_id"] = "held" if data["held"] else None
        return data
