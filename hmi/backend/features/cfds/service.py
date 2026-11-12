"""Business logic service boundary for CFDS operating mode."""

from __future__ import annotations

from .schemas import CfdsModeMetadata


def get_module_metadata() -> CfdsModeMetadata:
    return CfdsModeMetadata()
