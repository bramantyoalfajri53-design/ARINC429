from ate_power.config import AC_HV_THRESHOLD_VRMS, DC_HV_THRESHOLD_V
from ate_power.safety import (
    ac_freq_band,
    ac_requires_hv_confirm,
    ac_voltage_range,
    clamp_dc_voltage_to_ovp,
    dc_requires_hv_confirm,
    is_zero_off_preset,
    must_drop_output_for_frequency,
    must_drop_output_for_voltage,
)


def test_hv_thresholds_match_documented_standard():
    assert not dc_requires_hv_confirm(35.0)
    assert dc_requires_hv_confirm(35.01)
    assert not ac_requires_hv_confirm(130.0)
    assert ac_requires_hv_confirm(130.01)
    assert not ac_requires_hv_confirm(115.0)
    assert ac_requires_hv_confirm(230.0)


def test_ovp_is_not_auto_raised():
    assert clamp_dc_voltage_to_ovp(40.0, 35.0) == 34.0
    assert clamp_dc_voltage_to_ovp(28.0, 35.0) == 28.0
    assert clamp_dc_voltage_to_ovp(-1.0, 35.0) == 0.0


def test_ac6803b_ranges_are_135_and_270():
    assert ac_voltage_range(0.0) == 135
    assert ac_voltage_range(115.0) == 135
    assert ac_voltage_range(135.0) == 135
    assert ac_voltage_range(135.01) == 270
    assert ac_voltage_range(230.0) == 270


def test_live_hv_crossing_drops_output():
    assert must_drop_output_for_voltage(
        output_on=True, current_v=28.0, new_v=40.0, hv_threshold=DC_HV_THRESHOLD_V
    )
    assert must_drop_output_for_voltage(
        output_on=True, current_v=115.0, new_v=230.0, hv_threshold=AC_HV_THRESHOLD_VRMS
    )
    assert not must_drop_output_for_voltage(
        output_on=False, current_v=0.0, new_v=230.0, hv_threshold=AC_HV_THRESHOLD_VRMS
    )
    assert not must_drop_output_for_voltage(
        output_on=True, current_v=200.0, new_v=230.0, hv_threshold=AC_HV_THRESHOLD_VRMS
    )


def test_freq_band_change_while_live_drops_output():
    assert ac_freq_band(50.0) == "mains"
    assert ac_freq_band(60.0) == "mains"
    assert ac_freq_band(400.0) == "avionics"
    assert must_drop_output_for_frequency(output_on=True, current_hz=400.0, new_hz=50.0)
    assert not must_drop_output_for_frequency(output_on=False, current_hz=400.0, new_hz=50.0)
    assert not must_drop_output_for_frequency(output_on=True, current_hz=400.0, new_hz=390.0)


def test_zero_off_preset():
    assert is_zero_off_preset(0)
    assert not is_zero_off_preset(28)
