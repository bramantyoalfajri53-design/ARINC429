"""Power control orchestration and HV confirmation interlocks."""

from __future__ import annotations

from fastapi import HTTPException

from ate_power.config import AC_HV_THRESHOLD_VRMS, DC_HV_THRESHOLD_V
from ate_power.safety import ac_requires_hv_confirm, dc_requires_hv_confirm
from core.runtime import broker, broker_cmd


def require_dc_hv_confirm(enabled: bool, confirm: bool) -> None:
    set_v = broker.current_dc_set_voltage()
    if enabled and dc_requires_hv_confirm(set_v) and not confirm:
        raise HTTPException(
            status_code=409,
            detail={
                "needs_confirm": True,
                "kind": "dc",
                "threshold_v": DC_HV_THRESHOLD_V,
                "set_voltage": set_v,
                "message": (
                    f"DC output ON at {set_v:.2f} VDC "
                    f"exceeds {DC_HV_THRESHOLD_V:.0f} V. Confirm high voltage."
                ),
            },
        )


def require_ac_hv_confirm(enabled: bool, confirm: bool) -> None:
    set_v = broker.current_ac_set_voltage()
    if enabled and ac_requires_hv_confirm(set_v) and not confirm:
        raise HTTPException(
            status_code=409,
            detail={
                "needs_confirm": True,
                "kind": "ac",
                "threshold_v": AC_HV_THRESHOLD_VRMS,
                "set_voltage": set_v,
                "message": (
                    f"AC output ON at {set_v:.1f} Vrms "
                    f"exceeds {AC_HV_THRESHOLD_VRMS:.0f} V. Confirm high voltage."
                ),
            },
        )


def apply_dc_setpoint(voltage: float | None, current: float | None, ovp: float | None) -> None:
    if voltage is not None:
        broker_cmd("DC_SET_VOLT", voltage)
    if current is not None:
        broker_cmd("DC_SET_CURR", current)
    if ovp is not None:
        broker_cmd("DC_SET_OVP", ovp)


def apply_dc_output(enabled: bool, confirm_high_voltage: bool) -> None:
    require_dc_hv_confirm(enabled, confirm_high_voltage)
    broker_cmd("DC_SET_OUTP", enabled)


def apply_dc_preset(voltage: float) -> None:
    broker_cmd("DC_SET_VOLT", voltage)


def apply_ac_setpoint(voltage: float | None, frequency: float | None, current: float | None) -> None:
    if voltage is not None:
        broker_cmd("AC_SET_VOLT", voltage)
    if frequency is not None:
        broker_cmd("AC_SET_FREQ", frequency)
    if current is not None:
        broker_cmd("AC_SET_CURR", current)


def apply_ac_output(enabled: bool, confirm_high_voltage: bool) -> None:
    require_ac_hv_confirm(enabled, confirm_high_voltage)
    broker_cmd("AC_SET_OUTP", enabled)


def apply_ac_preset(voltage: float, frequency: float) -> None:
    broker_cmd("AC_SET_VOLT", voltage)
    broker_cmd("AC_SET_FREQ", frequency)


def trigger_estop() -> None:
    broker_cmd("EMERGENCY_STOP")


def rescan_instruments() -> None:
    broker_cmd("CONNECT")


def set_simulation_mode(enabled: bool) -> None:
    broker_cmd("SET_SIM_MODE", enabled)

