"""Pydantic schemas for Boeing CMC operating mode (D243W201-1 / ARINC 604-1)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

CmcScreenMode = Literal[
    "BITE_MAIN",
    "EDIT_CMD",
    "CONFIG_DATA",
    "SHOP_FAULTS",
    "CHANNELS",
    "TX_RX_SETUP",
]

CmcFunctionName = Literal[
    "NO REQUEST",
    "BITE TEST (IN-FLIGHT)",
    "SHOP FAULTS",
    "NEW FLIGHT LEG",
    "LOGOFF / TERMINATE",
    "CONFIG DATA REQUEST",
]

CmcSimResponseMode = Literal[
    "SUCCESS",
    "NO_ACK",
    "NO_MAINTENANCE_DATA",
    "TIMEOUT_12S",
]


class CmcModeMetadata(BaseModel):
    mode: str = "cmc"
    status: str = "active"


class CmcLruSelectRequest(BaseModel):
    lru_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    code: str = Field(..., min_length=1)


class CmcCommandSummaryRequest(BaseModel):
    function: CmcFunctionName
    ground_test_en: bool = True
    inflight_test_en: bool = True
    sensor_code: str = "0x1A"
    channel: str = Field(default="TX-A", pattern=r"^TX-[ABCD]$")


class CmcFaultToggleRequest(BaseModel):
    bit: int = Field(..., ge=11, le=28)
    fault: bool
    command_ack: bool | None = None


class CmcConfigDataRequest(BaseModel):
    channel: str = Field(default="TX-A", pattern=r"^TX-[ABCD]$")
    simulate_mode: CmcSimResponseMode = "SUCCESS"


class CmcShopFaultsRequest(BaseModel):
    channel: str = Field(default="TX-A", pattern=r"^TX-[ABCD]$")
    simulate_mode: CmcSimResponseMode = "SUCCESS"
