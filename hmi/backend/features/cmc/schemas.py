"""Pydantic schemas for Boeing CMC operating mode (Aeroflex T1200B / D243W201-1 / ARINC 604-1)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

CmcScreenMode = Literal[
    "TRANSMIT_DATA",
    "FAULT_SUMMARY",
    "EDIT_CMD",
    "SHOP_CONFIG",
    "CHANNELS",
    # Legacy aliases
    "BITE_MAIN",
    "CONFIG_DATA",
    "SHOP_FAULTS",
    "TX_RX_SETUP",
]

CmcFunctionName = Literal[
    "NO REQUEST",
    "BITE TEST",
    "SHOP FAULTS",
    "NEW FLIGHT",
    "LOGOFF",
    "CONFIG DATA",
    # Legacy aliases
    "BITE TEST (IN-FLIGHT)",
    "NEW FLIGHT LEG",
    "LOGOFF / TERMINATE",
    "CONFIG DATA REQUEST",
]

CmcSimResponseMode = Literal[
    "SUCCESS",
    "NO_ACK",
    "NO_MAINTENANCE_DATA",
    "TIMEOUT_12S",
    "BLOCK_COUNT_ERR",
]


class CmcModeMetadata(BaseModel):
    mode: str = "cmc"
    status: str = "active"


class CmcLruSelectRequest(BaseModel):
    lru_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    code: str = Field(..., min_length=1)
    time_constant: str = Field(default="OFF")


class CmcCommandSummaryRequest(BaseModel):
    function: CmcFunctionName = "NO REQUEST"
    eq_id: str = "007"
    pad: int = Field(default=0, ge=0, le=3)
    sdi: str = "00"
    rate_ms: int = Field(default=100, ge=10, le=10000)
    parity: str = "ODD"
    channel: str = Field(default="TX-A", pattern=r"^TX-[ABCD]$")
    # Legacy compatibility fields
    ground_test_en: bool = True
    inflight_test_en: bool = True
    sensor_code: str = "007"


class CmcFaultToggleRequest(BaseModel):
    label: str = Field(default="350", pattern=r"^35[01]$")
    bit: int = Field(..., ge=11, le=29)
    fault: bool
    command_ack: bool | None = None
    bite_inhibit: bool | None = None
    sdi: str | None = None
    ssm: str | None = None
    has_words: bool | None = None


class CmcFaultWordPageRequest(BaseModel):
    label: str = Field(..., pattern=r"^35[01]$")


class CmcTransmitDataRequest(BaseModel):
    date: str = "11/13/26"
    time: str = "09:30.0 GMT"
    flt_num: str = "AA1234"
    city_pairs: str = "KSEA KORD"
    flt_phase: int = Field(default=5, ge=1, le=10)
    aircraft_id: str = "N777AA"
    config_word_bits: dict[str, bool] = Field(default_factory=dict)
    channel: str = Field(default="TX-A", pattern=r"^TX-[ABCD]$")


class CmcTerminalActionRequest(BaseModel):
    action: str = "KEY_PRESS"
    key: str = ""
    view: str = "MENU"  # "MENU" | "SHOP_FAULTS" | "CONFIG_DATA"
    channel: str = Field(default="TX-A", pattern=r"^TX-[ABCD]$")
    simulate_mode: CmcSimResponseMode = "SUCCESS"


class CmcConfigDataRequest(BaseModel):
    channel: str = Field(default="TX-A", pattern=r"^TX-[ABCD]$")
    simulate_mode: CmcSimResponseMode = "SUCCESS"


class CmcShopFaultsRequest(BaseModel):
    channel: str = Field(default="TX-A", pattern=r"^TX-[ABCD]$")
    simulate_mode: CmcSimResponseMode = "SUCCESS"
