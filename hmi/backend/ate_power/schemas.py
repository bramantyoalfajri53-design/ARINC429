"""Request/response models for the Power HMI API."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    pin: str = Field(min_length=1, max_length=64)


class DcSetpointRequest(BaseModel):
    voltage: Optional[float] = Field(default=None, ge=0.0, le=40.0)
    current: Optional[float] = Field(default=None, ge=0.0, le=19.0)
    ovp: Optional[float] = Field(default=None, ge=1.0, le=45.0)


class AcSetpointRequest(BaseModel):
    voltage: Optional[float] = Field(default=None, ge=0.0, le=270.0)
    frequency: Optional[float] = Field(default=None, ge=45.0, le=500.0)
    current: Optional[float] = Field(default=None, ge=0.0, le=20.0)


class OutputRequest(BaseModel):
    enabled: bool
    confirm_high_voltage: bool = False


class DcPresetRequest(BaseModel):
    voltage: float = Field(ge=0.0, le=40.0)


class AcPresetRequest(BaseModel):
    voltage: float = Field(ge=0.0, le=270.0)
    frequency: float = Field(ge=45.0, le=500.0)


class SimulationRequest(BaseModel):
    enabled: bool
