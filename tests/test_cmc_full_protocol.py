"""Full Protocol & API Verification for Boeing CMC / Sensor BITE (ARINC 604 — Label 227 & Label 350)."""

from __future__ import annotations

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

import ate_platform.web.arinc_session as sess_mod
from ate_platform.device.cmc import (
    CMC_AIRCRAFT_CONFIG_ORDER,
    CMC_FAULT_BIT_MAPS,
    CMC_FUNCTION_SWITCHES,
    CMC_LRU_TABLE,
    CmcProtocolManager,
    decode_cmc_label350,
    encode_cmc_label227,
    encode_cmc_label350,
    encode_cmc_transmit_words,
)
from ate_platform.web.app import create_app
from ate_platform.web.arinc_session import ArincSession

PIN = "2468"


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ATE_FORCE_SIM", "1")
    monkeypatch.setenv("ATE_UI_PIN", PIN)
    app = create_app(simulation=True, out_dir=tmp_path)
    with TestClient(app) as c:
        r = c.post("/api/auth/login", json={"pin": PIN})
        assert r.status_code == 200
        yield c


def test_cmc_lru_table_and_manual_entry():
    """Verify all 19 LRUs + MANUAL ENTRY and channel C 100k auto-setup for 750 VDR."""
    mgr = CmcProtocolManager()
    state = mgr.get_state()
    assert len(state["lru_table"]) == 19
    assert len(CMC_LRU_TABLE) == 19

    # Select 707 LRA
    s_lra = mgr.select_lru("707 LRA")
    assert s_lra["selected_lru"]["code"] == "007"
    assert s_lra["selected_lru"]["short"] == "RALT"
    assert s_lra["current_slide"] == "desired_mode"

    # Select 750 VDR (high speed Channel C)
    s_vdr = mgr.select_lru("750 VDR")
    assert s_vdr["selected_lru"]["code"] == "050"
    assert s_vdr["channels"]["bit_rate_kbps"] == "100"
    assert s_vdr["channels"]["xmtr_select"] == "TX-C"

    # Manual Entry with custom code
    s_man = mgr.select_lru("MANUAL ENTRY", manual_code="5A3")
    assert s_man["selected_lru"]["name"] == "MANUAL ENTRY"
    assert s_man["selected_lru"]["code"] == "5A3"


def test_cmc_per_lru_bit_maps_707_709_and_all_19():
    """Verify exact JcAIR T1200B bits 11-29 maps for 707 LRA, 709 DME, and all 19+1 LRUs."""
    # Exact 707 LRA (Slide 4)
    lra = CMC_FAULT_BIT_MAPS["707 LRA"]
    assert lra[11] == "LRRA LRU FAULT"
    assert lra[12] == "NO CTL BUS INPUT"
    assert lra[13] == "ANTENNA FAULT"
    assert lra[14] == "ARINC 429 XMITTER FAULT"
    assert lra[15] == "NO ADC BUS INPUT"
    assert lra[28] == "DATA TRANSFER IN PROGRESS"
    assert lra[29] == "CMND WORD ACKNOWLEDGE"

    # Exact 709 DME (Slide 10)
    dme = CMC_FAULT_BIT_MAPS["709 DME"]
    assert dme[11] == "DME LRU FAULT"
    assert dme[12] == "CONTROL UNIT FAULT"
    assert dme[13] == "ANTENNA FAULT"
    assert dme[14] == "NOT USED"
    assert dme[15] == "TEST INHIBIT"
    assert dme[28] == "DATA TRANSFER IN PROGRESS"
    assert dme[29] == "CMND WORD ACKNOWLEDGE"

    # All 19 LRUs + MANUAL ENTRY must define bits 11..29 completely
    expected_names = [row["name"] for row in CMC_LRU_TABLE] + ["MANUAL ENTRY"]
    for name in expected_names:
        bmap = CMC_FAULT_BIT_MAPS[name]
        assert set(bmap.keys()) == set(range(11, 30))
        assert "LRU FAULT" in bmap[11] or "MU FAULT" in bmap[11]
        assert bmap[28] == "DATA TRANSFER IN PROGRESS"
        assert bmap[29] == "CMND WORD ACKNOWLEDGE"


def test_cmc_label227_command_and_6_switches():
    """Verify Label 227 encoder, field edits, 6 switches, and SIM ACK bit 29 behavior."""
    raw0, hex0 = encode_cmc_label227(eq_id="007", function_code=1, pad="00", sdi="ALL", parity="ODD")
    assert hex0.startswith("0x")
    assert isinstance(raw0, int)

    raw_e, hex_e = encode_cmc_label227(eq_id="007", function_code=1, pad="00", sdi="ALL", parity="EVEN")
    assert raw_e != raw0  # Even parity toggles bit 32

    assert [f["code"] for f in CMC_FUNCTION_SWITCHES] == [0, 1, 2, 3, 4, 5]
    assert [f["label"] for f in CMC_FUNCTION_SWITCHES] == [
        "NO REQUEST", "BITE TEST", "SHOP FAULTS", "FLIGHT", "LOGOFF", "CONFIG DATA"
    ]

    mgr = CmcProtocolManager(simulation_mode=True)
    mgr.select_lru("709 DME")

    # Non-zero command (BITE TEST = 1) triggers Label 350 ACK bit 29 = 1 in simulation
    st, rec = mgr.send_command(eq_id="009", function_code=1, sdi="1", rate_ms=250)
    assert rec["eq_id"] == "009"
    assert rec["function_label"] == "BITE TEST"
    assert st["fault_summary"]["has_data"] is True
    assert st["fault_summary"]["bit_dict"][29] == 1

    # SHOP FAULTS = 2 triggers bit 28 (DATA TRANSFER IN PROGRESS) & bit 29 (ACK)
    st2, _ = mgr.send_command(function_code=2)
    assert st2["fault_summary"]["bit_dict"][28] == 1
    assert st2["fault_summary"]["bit_dict"][29] == 1


def test_cmc_label350_rx_decode_and_no_words_received(client: TestClient):
    """Verify NO WORDS RECEIVED until real/ingested Label 350 word arrives."""
    # A. API check: SIM: OFF clears buffer and returns NO WORDS RECEIVED
    r_sim = client.post("/api/arinc/cmc/sim-mode", json={"enabled": False})
    assert r_sim.status_code == 200
    assert r_sim.json()["simulation_mode"] is False
    assert r_sim.json()["fault_summary"]["has_data"] is False
    assert r_sim.json()["fault_summary"]["formatted"] == "NO WORDS RECEIVED"

    r_lru = client.post("/api/arinc/cmc/select-lru", json={"lru": "707 LRA"})
    assert r_lru.status_code == 200
    assert r_lru.json()["fault_summary"]["has_data"] is False
    assert r_lru.json()["fault_summary"]["formatted"] == "NO WORDS RECEIVED"

    # B. Direct ArincSession RX ingestion check (Ballard bus Label 350)
    sess = ArincSession(simulation=True)
    sess.set_cmc_sim_mode(False)
    sess.select_cmc_lru("707 LRA")
    assert sess.get_cmc_state()["fault_summary"]["formatted"] == "NO WORDS RECEIVED"

    raw350, _ = encode_cmc_label350({11: 1, 13: 1, 29: 1}, sdi=2, ssm=3, odd_parity=True)
    sess.ingest_rx_word("A", raw350)

    st = sess.get_cmc_state()
    fs = st["fault_summary"]
    assert fs["has_data"] is True
    assert "NO WORDS RECEIVED" not in fs["formatted"]
    assert fs["sdi"] == 2
    assert fs["ssm"] == 3
    assert fs["parity"] == "ODD"
    bits_by_num = {b["bit"]: b for b in fs["bits"]}
    assert bits_by_num[11]["status"] == 1
    assert bits_by_num[11]["function"] == "LRRA LRU FAULT"
    assert bits_by_num[12]["status"] == 0
    assert bits_by_num[13]["status"] == 1
    assert bits_by_num[29]["status"] == 1

    # Verify Display Mode switch (BIN / HEX / ENG) re-formats live word
    st_bin = sess.set_cmc_channels(display_mode="BIN")
    assert " " in st_bin["fault_summary"]["formatted"]
    st_hex = sess.set_cmc_channels(display_mode="HEX")
    assert st_hex["fault_summary"]["formatted"].startswith("0x")


def test_cmc_tx_data_and_17_aircraft_config_switches(client: TestClient):
    """Verify Labels 260, 125, 126, 233-236, and 17-bit Label 170 encoding via API."""
    assert len(CMC_AIRCRAFT_CONFIG_ORDER) == 17
    all_on = {k: True for k in CMC_AIRCRAFT_CONFIG_ORDER}
    res = client.post(
        "/api/arinc/cmc/tx-data",
        json={
            "tx_params": {
                "date": "11/26/26",
                "time": "14:05.2",
                "flt_num": "GA123456",
                "city_pairs": "CGK SIN",
                "flt_phase": "4",
                "aircraft_id": "PK-GAA",
            },
            "aircraft_config": all_on,
            "time_constant": "1.6",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["time_constant"] == "1.6"
    assert body["tx_params"]["city_pairs"] == "CGK SIN"
    assert all(body["aircraft_config"][k] is True for k in CMC_AIRCRAFT_CONFIG_ORDER)
    labels = [w["label"] for w in body["encoded_words"]]
    assert labels == ["260", "125", "126", "233", "234", "235", "236", "170"]

    # Verify standalone encoder consistency
    words = encode_cmc_transmit_words(body["tx_params"], all_on)
    assert len(words) == 8


def test_cmc_sim_mode_override_refresh_and_hardware_isolation(client: TestClient, tmp_path: Path):
    """Verify SIM: ON/OFF works independently of hardware session & CFDS, plus Refresh & sim-bit."""
    orig_bti = sess_mod.HAS_BTIDRIVER
    orig_force = sess_mod.force_simulation
    try:
        sess_mod.HAS_BTIDRIVER = True
        sess_mod.force_simulation = lambda: False
        hw_sess = ArincSession(simulation=True)
        hw_sess.simulation_mode = False
        hw_sess._sim_override = False
        hw_sess.hardware_info = {
            "simulated": False,
            "open_error": None,
            "cores": [{"core": 0, "open_ok": True, "count": 1}],
        }
        # Default with Ballard hardware connected -> CMC SIM is OFF, CFDS unaffected
        assert hw_sess.is_cmc_simulation_active() is False
        assert hw_sess.is_cfds_simulation_active() is False

        # Toggling CMC SIM ON does not touch _sim_override or _cfds_sim_override
        st_on = hw_sess.set_cmc_sim_mode(True)
        assert st_on["simulation_mode"] is True
        assert hw_sess._cmc_sim_override is True
        assert hw_sess._cfds_sim_override is None
        assert hw_sess._sim_override is False
    finally:
        sess_mod.HAS_BTIDRIVER = orig_bti
        sess_mod.force_simulation = orig_force

    # End-to-end API SIM: ON -> sim-bit -> Refresh -> SIM: OFF -> Refresh
    assert client.post("/api/arinc/cmc/select-lru", json={"lru": "709 DME"}).status_code == 200
    assert client.post("/api/arinc/cmc/sim-mode", json={"enabled": True}).status_code == 200
    assert client.post("/api/arinc/cmc/command", json={"function_code": 1}).status_code == 200

    # Manual sim-bit toggle on bit 13 (ANTENNA FAULT for 709 DME)
    r_bit = client.post("/api/arinc/cmc/sim-bit", json={"bit": 13, "status": 1})
    assert r_bit.status_code == 200
    assert r_bit.json()["fault_summary"]["bit_dict"]["13"] == 1
    assert r_bit.json()["fault_summary"]["bit_dict"]["29"] == 1

    # Refresh in SIM: ON retains active data
    r_ref_on = client.post("/api/arinc/cmc/refresh")
    assert r_ref_on.status_code == 200
    assert r_ref_on.json()["fault_summary"]["has_data"] is True

    # Snapshot exposes "cmc" cleanly
    snap = client.get("/api/arinc/snapshot")
    assert snap.status_code == 200
    assert snap.json()["cmc"]["selected_lru"]["name"] == "709 DME"
    assert snap.json()["cmc"]["simulation_mode"] is True

    # Toggle SIM: OFF -> clears buffer & displays NO WORDS RECEIVED
    r_off = client.post("/api/arinc/cmc/sim-mode", json={"enabled": False})
    assert r_off.status_code == 200
    assert r_off.json()["simulation_mode"] is False
    assert r_off.json()["fault_summary"]["has_data"] is False
    assert r_off.json()["fault_summary"]["formatted"] == "NO WORDS RECEIVED"
    r_ref_off = client.post("/api/arinc/cmc/refresh")
    assert r_ref_off.json()["fault_summary"]["formatted"] == "NO WORDS RECEIVED"
