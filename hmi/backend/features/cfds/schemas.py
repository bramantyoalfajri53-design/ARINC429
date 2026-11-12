"""Pydantic schemas and request/response contracts for CFDS operating mode."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

CfdsStandard = Literal["ABD0018", "ABD0048"]
CfdsSubmode = Literal["NORMAL", "MENU", "INTERACTIVE", "DISCRETE", "CONFIGURE"]
CfdsNormalSimScenario = Literal["FIGURE_58_PASS", "COUNT_ERROR", "CLEAR"]
CfdsDiscreteSimScenario = Literal["SINGLE_FIG73", "MULTI_FIG74", "CLEAR"]
ArincBusSpeedLiteral = Literal["100k", "12.5k"]


class CfdsModeMetadata(BaseModel):
    mode: str = "cfds"
    status: str = "active"
    standards: list[str] = Field(default_factory=lambda: ["ABD0018", "ABD0048"])


class CfdsLruSelectRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=3, pattern=r"^[0-9A-Fa-f]{3}$")
    name: str = Field(..., min_length=1, max_length=40)
    description: str = Field(default="", max_length=160)


class CfdsAircraftConfigModel(BaseModel):
    printer: bool = False
    link: bool = False
    aids: bool = False
    rmp3: bool = False
    vhf3: bool = False
    hf1: bool = False
    hf2: bool = False
    adf2: bool = False
    mls1: bool = False
    mls2: bool = False
    wbs1: bool = False
    radar2: bool = False
    tpis: bool = False
    aftCrgHt: bool = False
    fwdCrgHt: bool = False
    crgSmoke: bool = False
    wbs2: bool = False


class CfdsTxParamsRequest(BaseModel):
    date: str = Field(..., min_length=1, max_length=16)
    time: str = Field(default="120000", min_length=1, max_length=12)
    flightNumber: str = Field(default="GA402", min_length=1, max_length=6)
    cityPairs: str = Field(default="CGKDPS", min_length=6, max_length=6, pattern=r"^[A-Za-z]{6}$")
    aircraftId: str = Field(default="N12345", min_length=1, max_length=8)
    flightPhase: int = Field(default=0, ge=0, le=12)
    aircraftConfig: CfdsAircraftConfigModel | None = None


class CfdsBiteCommandRequest(BaseModel):
    equipment_code: str = Field(..., min_length=3, max_length=3, pattern=r"^[0-9A-Fa-f]{3}$")
    command_code: int = Field(..., ge=0, le=127)
    sdi: int = Field(default=0, ge=0, le=3)
    ready: bool = False
    bit12: bool = False
    channel: str = Field(default="TX-A", pattern=r"^TX-[A-D]$")
    submode: CfdsSubmode = "NORMAL"
    action_label: str = Field(default="", max_length=64)


class CfdsNormalSimulateRequest(BaseModel):
    scenario: CfdsNormalSimScenario = "FIGURE_58_PASS"
    channel: str = Field(default="RX-A", pattern=r"^RX-[A-D]$")


class CfdsDiscreteSimulateRequest(BaseModel):
    scenario: CfdsDiscreteSimScenario = "SINGLE_FIG73"
    channel: str = Field(default="RX-A", pattern=r"^RX-[A-D]$")


class CfdsChannelConfigRequest(BaseModel):
    channel: str = Field(..., pattern=r"^(TX|RX)-[A-D]$")
    speed: ArincBusSpeedLiteral | None = None
    enabled: bool | None = None
    trap_label: str | None = Field(default=None, max_length=3)
    trap_active: bool | None = None
