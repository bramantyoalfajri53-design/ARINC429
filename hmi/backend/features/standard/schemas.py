"""Pydantic schemas for Standard operating mode (Aeroflex JcAIR T1200 / T1200B)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class StandardModeMetadata(BaseModel):
    mode: str = "standard"
    status: str = "active"


class StandardTxSlotModel(BaseModel):
    slot: int = Field(..., ge=1, le=10)
    label: str = Field(..., pattern=r"^[0-3][0-7]{2}$")
    sdi: str = Field(default="00", pattern=r"^(00|01|10|11)$")
    data: str = Field(default="000000", pattern=r"^[0-9A-Fa-f]{1,6}$")
    ssm: Literal["NO", "NCD", "FT", "FW"] = "NO"
    parity: Literal["ODD", "EVEN"] = "ODD"
    rate: int = Field(default=100, ge=10, le=5000)
    enabled: bool = False


class StandardTransmitRequest(BaseModel):
    channel: str = Field(default="TX-A", pattern=r"^TX-[ABCD]$")
    slot: StandardTxSlotModel
