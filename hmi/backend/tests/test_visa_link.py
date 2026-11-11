from ate_power.visa_link import lxi_resource_candidates, resource_candidates


def test_lxi_candidates_prefer_hislip_then_vxi11_then_socket():
    assert lxi_resource_candidates("10.11.11.12") == [
        "TCPIP0::10.11.11.12::hislip0::INSTR",
        "TCPIP0::10.11.11.12::inst0::INSTR",
        "TCPIP0::10.11.11.12::5025::SOCKET",
    ]


def test_resource_order_explicit_lxi_then_gpib():
    got = resource_candidates(
        explicit="TCPIP0::10.11.11.11::inst0::INSTR",
        lxi_host="10.11.11.11",
        gpib_fallback="GPIB0::5::INSTR",
    )
    assert got[0] == "TCPIP0::10.11.11.11::inst0::INSTR"
    assert "TCPIP0::10.11.11.11::hislip0::INSTR" in got
    assert got[-1] == "GPIB0::5::INSTR"
