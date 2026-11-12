"""Pydantic schemas for CFDS operating mode (ready for parallel team development)."""

from __future__ import annotations

from pydantic import BaseModel


class CfdsModeMetadata(BaseModel):
    mode: str = "cfds"
    status: str = "scaffold"
