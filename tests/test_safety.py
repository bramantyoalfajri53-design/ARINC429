from ate_platform.device.safety import (
    ac_requires_hv_confirm,
    ac_voltage_range,
    clamp_dc_voltage_to_ovp,
    dc_requires_hv_confirm,
    must_drop_output_for_frequency,
    must_drop_output_for_voltage,
)
from ate_platform.device.visa_link import lxi_resource_candidates, resource_candidates


def test_hv_thresholds():
    assert not dc_requires_hv_confirm(35.0)
    assert dc_requires_hv_confirm(35.01)
    assert not ac_requires_hv_confirm(130.0)
    assert ac_requires_hv_confirm(230.0)


def test_ovp_clamp():
    assert clamp_dc_voltage_to_ovp(40.0, 35.0) == 34.0


def test_ac_ranges():
    assert ac_voltage_range(115) == 135
    assert ac_voltage_range(230) == 270


def test_live_drops():
    assert must_drop_output_for_voltage(
        output_on=True, current_v=28, new_v=40, hv_threshold=35
    )
    assert must_drop_output_for_frequency(output_on=True, current_hz=400, new_hz=50)


def test_lxi_candidates():
    assert lxi_resource_candidates("10.11.11.12")[0].endswith("hislip0::INSTR")
    got = resource_candidates(
        explicit="TCPIP0::10.11.11.11::inst0::INSTR",
        lxi_host="10.11.11.11",
        gpib_fallback="GPIB0::5::INSTR",
    )
    assert got[0].startswith("TCPIP")
    assert got[-1] == "GPIB0::5::INSTR"
