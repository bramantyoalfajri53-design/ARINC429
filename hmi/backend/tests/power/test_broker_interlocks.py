from ate_power.broker import InstrumentBroker


def _sim_broker() -> InstrumentBroker:
    broker = InstrumentBroker(simulation_mode=True)
    broker.dc.simulation_mode = True
    broker.dc.connected = True
    broker.ac.simulation_mode = True
    broker.ac.connected = True
    return broker


def test_live_dc_hv_crossing_drops_output_and_respects_ovp():
    broker = _sim_broker()
    broker._execute("DC_SET_VOLT", (28.0,))
    broker._execute("DC_SET_OUTP", (True,))
    assert broker.dc.output_enabled

    broker._execute("DC_SET_VOLT", (40.0,))
    assert not broker.dc.output_enabled
    assert broker.dc.voltage_set == 34.0  # OVP 35 V − 1 V margin


def test_live_ac_230v_50hz_preset_does_not_stay_energized():
    broker = _sim_broker()
    broker._execute("AC_SET_VOLT", (115.0,))
    broker._execute("AC_SET_FREQ", (400.0,))
    broker._execute("AC_SET_OUTP", (True,))
    assert broker.ac.output_enabled

    broker._execute("AC_SET_VOLT", (230.0,))
    broker._execute("AC_SET_FREQ", (50.0,))
    assert not broker.ac.output_enabled
    assert broker.ac.voltage_rms_set == 230.0
    assert broker.ac.frequency_set == 50.0


def test_zero_off_preset_disables_output():
    broker = _sim_broker()
    broker._execute("DC_SET_VOLT", (28.0,))
    broker._execute("DC_SET_OUTP", (True,))
    broker._execute("DC_SET_VOLT", (0.0,))
    assert not broker.dc.output_enabled
    assert broker.dc.voltage_set == 0.0
