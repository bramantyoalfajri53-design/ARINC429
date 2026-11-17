"""Software safety interlocks for DC/AC power (station policy)."""

from __future__ import annotations

DC_OVP_MARGIN_V = 1.0
AC_RANGE_LOW_V = 135
AC_RANGE_HIGH_V = 270
AC_RANGE_SWITCH_V = 135.0
AC_MAINS_FREQ_MAX_HZ = 65.0
AC_AVIONICS_FREQ_MIN_HZ = 360.0
AC_AVIONICS_FREQ_MAX_HZ = 440.0


def dc_requires_hv_confirm(voltage_v: float, threshold_v: float = 35.0) -> bool:
    return float(voltage_v) > float(threshold_v)


def ac_requires_hv_confirm(voltage_vrms: float, threshold_vrms: float = 130.0) -> bool:
    return float(voltage_vrms) > float(threshold_vrms)


def clamp_dc_voltage_to_ovp(voltage_v: float, ovp_v: float, margin_v: float = DC_OVP_MARGIN_V) -> float:
    ceiling = max(0.0, float(ovp_v) - float(margin_v))
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


def must_drop_output_for_voltage(
    *, output_on: bool, current_v: float, new_v: float, hv_threshold: float
) -> bool:
    return bool(output_on and float(new_v) > hv_threshold and float(current_v) <= hv_threshold)


def must_drop_output_for_frequency(*, output_on: bool, current_hz: float, new_hz: float) -> bool:
    if not output_on:
        return False
    return ac_freq_band(current_hz) != ac_freq_band(new_hz)


def is_zero_off(voltage: float) -> bool:
    return float(voltage) <= 0.0
