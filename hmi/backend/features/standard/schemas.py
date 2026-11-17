"""Pydantic schemas for Standard operating mode (Aeroflex JcAIR T1200 / T1200B)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class StandardModeMetadata(BaseModel):
    mode: str = "standard"
    status: str = "active"


class StandardTxSlotModel(BaseModel):
    slot: int = Field(..., ge=0, le=9)
    label: str = Field(..., pattern=r"^[0-3][0-7]{2}$")
    sdi: str = Field(default="00", pattern=r"^(00|01|10|11)$")
    data: str = Field(default="000000")
    ssm: Literal["NO", "NCD", "FT", "FW", "NML"] = "NML"
    parity: Literal["ODD", "EVEN"] = "ODD"
    rate: int = Field(default=100, ge=10, le=5000)
    enabled: bool = False
    pad: str = Field(default="0000", pattern=r"^[01]*$")
    function: str = Field(default="")


class StandardTransmitRequest(BaseModel):
    channel: str = Field(default="TX-A", pattern=r"^TX-[ABCD]$")
    slot: StandardTxSlotModel


class LruParamFieldSchema(BaseModel):
    id: str
    name: str
    param_type: str
    bit_start: int
    bit_end: int
    default: Any
    unit: str = ""
    options: list[str] = Field(default_factory=list)
    min_val: float | None = None
    max_val: float | None = None
    regex: str | None = None
    description: str = ""


class LruDefinitionSummary(BaseModel):
    id: str
    code: str
    name: str
    standard_lru: str
    modes_supported: list[str]
    default_tx_channel: str
    default_rx_channel: str
    default_bit_rate: str


class LruDetailResponse(LruDefinitionSummary):
    tx_template: dict[str, Any]
    rx_template: dict[str, Any]
    fields: list[LruParamFieldSchema]


class LruSingleModeTransmitRequest(BaseModel):
    lru_id: str
    channel: str = Field(default="TX-A", pattern=r"^TX-[ABCD]$")
    slot: int = Field(default=0, ge=0, le=9)
    label: str = Field(..., pattern=r"^[0-3][0-7]{2}$")
    function: str = Field(default="DME FREQ")
    data: str = Field(..., description="Engineering data string e.g. '108.00 MHZ' or hex")
    sdi: str = Field(default="00", pattern=r"^(00|01|10|11)$")
    pad: str = Field(default="1100001", pattern=r"^[01]+$")
    ssm: str = Field(default="NML")
    parity: Literal["ODD", "EVEN"] = "ODD"
    rate: int = Field(default=150, ge=10, le=5000)
    # Extra hardware / simulation fields
    extra_params: dict[str, Any] = Field(default_factory=dict)
