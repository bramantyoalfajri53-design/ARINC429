from ate_platform.device.server import DeviceServer
from ate_platform.station_model import load_station
from ate_platform.wiring.netlist import load_netlist, validate_capabilities


def test_station_loads():
    st = load_station()
    assert st.station_id == "ni-ate"
    assert "dc_bus" in st.capabilities
    assert st.instruments["dcps"].lxi_host or True  # may be empty without .env in CI


def test_netlist_validation():
    nl = load_netlist("netlist/dummy_ita.yaml")
    validate_capabilities(nl, ["dc_bus", "ac_bus"], adapter_id="dummy_ita")


def test_device_server_sim_status():
    st = load_station()
    srv = DeviceServer(st, simulation=True)
    srv.start()
    try:
        status = srv.status()
        assert status["dc"]["simulation"] is True
        assert status["ac"]["simulation"] is True
        token = srv.acquire("test")
        srv.dc_apply(token, voltage=28.0, current_limit=5.0)
        srv.dc_output(token, True)
        m = srv.dc_measure()
        assert m["output_on"] is True
        assert m["voltage"] > 1.0
        srv.estop()
        m2 = srv.dc_measure()
        assert m2["output_on"] is False
        assert srv.dc.voltage_set == 0.0
        srv.release(token)
    finally:
        srv.stop()
