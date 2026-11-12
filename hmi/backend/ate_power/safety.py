"""Software safety interlocks for ATE DC/AC power control.

Aligned with docs/programming_and_api_guide.md §2 (DO-160 / MIL-STD-704F
lab practice): cold-start 0 V, hardware OVP, current limit before enable,
HV operator confirm, AC frequency clamp, fail-safe output drop.
"""

from __future__ import annotations

from .config import AC_HV_THRESHOLD_VRMS, DC_HV_THRESHOLD_V

# Hardware OVP must stay above the DC setpoint (N5746A nuisance-trip margin).
DC_OVP_MARGIN_V = 1.0

# AC6803B range switch point: low 135 Vrms, high 270 Vrms (max set 137.5 / 275).
AC_RANGE_LOW_V = 135
AC_RANGE_HIGH_V = 270
AC_RANGE_SWITCH_V = 135.0

# Frequency bands: keep 400 Hz-class UUTs from seeing mains while energized.
AC_MAINS_FREQ_MAX_HZ = 65.0
AC_AVIONICS_FREQ_MIN_HZ = 360.0
AC_AVIONICS_FREQ_MAX_HZ = 440.0


def dc_requires_hv_confirm(voltage_v: float) -> bool:
    return float(voltage_v) > DC_HV_THRESHOLD_V


def ac_requires_hv_confirm(voltage_vrms: float) -> bool:
    return float(voltage_vrms) > AC_HV_THRESHOLD_VRMS


def clamp_dc_voltage_to_ovp(voltage_v: float, ovp_v: float) -> float:
    """Never let the DC setpoint reach the hardware OVP trip point."""
    ceiling = max(0.0, float(ovp_v) - DC_OVP_MARGIN_V)
    return max(0.0, min(float(voltage_v), ceiling))


def ac_voltage_range(volts_rms: float) -> int:
    return AC_RANGE_HIGH_V if float(volts_rms) > AC_RANGE_SWITCH_V else AC_RANGE_LOW_V


def ac_freq_band(freq_hz: float) -> str:
    f = float(freq_hz)
    if f <= AC_MAINS_FREQ_MAX_HZ:
        return "mains"
    if AC_AVIONICS_FREQ_MIN_HZ <= f <= AC_AVIONICS_FREQ_MAX_HZ:
        return "avionics"
    return "other"


def must_drop_output_for_voltage(*, output_on: bool, current_v: float, new_v: float, hv_threshold: float) -> bool:
    """Energized output must not cross into the HV region without a fresh ON + confirm."""
    return bool(output_on and float(new_v) > hv_threshold and float(current_v) <= hv_threshold)


def must_drop_output_for_frequency(*, output_on: bool, current_hz: float, new_hz: float) -> bool:
    """Do not change mains ↔ avionics (or other) frequency bands while the AC output is live."""
    if not output_on:
        return False
    return ac_freq_band(current_hz) != ac_freq_band(new_hz)


def is_zero_off_preset(voltage: float) -> bool:
    return float(voltage) <= 0.0
