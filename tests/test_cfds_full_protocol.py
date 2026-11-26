"""Full Protocol & API Verification for CFDS (Aeroflex JcAIR T1200B / ABD0018 & ABD0048)."""

from __future__ import annotations

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from ate_platform.device.arinc_encode import parse_label
from ate_platform.device.cfds import (
    CFDS_LRU_TABLE,
    DEFAULT_AIRCRAFT_CONFIG,
    DEFAULT_DISCRETE_FIELDS,
    CfdsProtocolManager,
    decode_iso5_ascii,
    encode_label227_word,
)
from ate_platform.web.app import create_app

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


def test_cfds_lru_table_and_manual_entry():
    """Verify 19 CFDS LRUs + MANUAL ENTRY matching Slide 1."""
    mgr = CfdsProtocolManager()
    state = mgr.get_state()
    lrus = state["lru_table"]
    assert len(lrus) == 19

    # Verify key LRUs
    codes = {l["code"] for l in lrus}
    assert "007" in codes  # 707 LRA
    assert "009" in codes  # 709 DME
    assert "010" in codes  # 710 ILS
    assert "011" in codes  # 711 VOR
    assert "012" in codes  # 712 ADF
    assert "016" in codes  # 716 VHF
    assert "018" in codes  # 718 ATC & ATC/S
    assert "019" in codes  # 719 HF
    assert "050" in codes  # 750 VDR (High-Speed Channel C)

    # Test selecting standard LRU
    res = mgr.select_lru("009")
    assert res["selected_lru"]["short"] == "DME"
    assert res["current_slide"] == "desired_mode"

    # Test manual entry with custom equipment code
    res_man = mgr.select_lru("999", name="CUSTOM SENSOR", short="CUST")
    assert res_man["selected_lru"]["code"] == "999"
    assert res_man["selected_lru"]["short"] == "CUST"


def test_cfds_vdr_auto_channel_c():
    """Verify 750 VDR automatically selects Channel C (100k) per JcAIR spec."""
    mgr = CfdsProtocolManager()
    res = mgr.select_lru("050")
    assert res["selected_lru"]["code"] == "050"
    assert res["channel_config"]["xmtr_select"] == "C"


def test_cfds_edit_tx_and_17_config_toggles():
    """Verify Slide 3 TX parameters and 17 Aircraft Configuration Word toggles."""
    mgr = CfdsProtocolManager()
    mgr.select_lru("011")  # VOR

    # Update TX parameters
    params = {
        "date": "06/15/26",
        "time": "12:30.0",
        "flt_num": "GA429",
        "city_pairs": "WIII WADD",
        "flt_phase": "3",
        "aircraft_id": "PK-GIA",
    }
    config = {
        "DATA_PRINTER": True,
        "DATA_LINK": True,
        "VHF3": True,
        "RADAR2": True,
        "TPIS": True,
        "WBS1": True,
    }
    res = mgr.update_tx_params(params, config)
    assert res["tx_params"]["flt_num"] == "GA429"
    assert res["tx_params"]["city_pairs"] == "WIII WADD"
    assert res["aircraft_config"]["DATA_PRINTER"] is True
    assert res["aircraft_config"]["RADAR2"] is True
    assert res["aircraft_config"]["TPIS"] is True
    assert res["aircraft_config"]["HF1"] is False  # default unchanged


def test_cfds_flight_phase_toggle():
    """Verify Flight Phase toggle between GROUND and AIR (Slide 6 & 8)."""
    mgr = CfdsProtocolManager()
    assert mgr.flight_phase_mode == "GROUND"

    mgr.set_flight_phase("AIR")
    assert mgr.flight_phase_mode == "AIR"

    mgr.set_flight_phase("GROUND")
    assert mgr.flight_phase_mode == "GROUND"


def test_cfds_label227_bite_command_encoder():
    """Verify Label 227 BITE command word encoder for MCDU Line Select Keys."""
    # Key 1 / 1L -> command code 1
    raw, hex_str = encode_label227_word(equipment_code="009", command_code=1, sdi=0, ready=True)
    expected_wire_label = parse_label("227")
    assert raw & 0xFF == expected_wire_label
    assert ((raw >> 10) & 1) == 1  # Bit 11 Ready flag is set

    mgr = CfdsProtocolManager()
    res = mgr.send_key_command("1L", lru_code="009")
    assert res["last_tx_command"]["key"] == "1L"
    assert res["last_tx_command"]["command_code"] == 1
    assert "LBL 227" in res["mcdu_status"]


def test_cfds_dynamic_label356_decoding():
    """Verify Label 356 (ISO #5) dynamic ASCII decoding into MCDU and Normal messages."""
    mgr = CfdsProtocolManager()
    mgr.select_lru("009")  # DME

    # Construct word with ISO #5 characters:
    # Bit 11..17 = Char 1, Bit 18..24 = Char 2, Bit 25..31 = Char 3
    char1 = ord('T')
    char2 = ord('E')
    char3 = ord('S')
    data_field = (char1 & 0x7F) | ((char2 & 0x7F) << 7) | ((char3 & 0x7F) << 14)
    raw_word = parse_label("356") | (data_field << 10)

    decoded = decode_iso5_ascii(raw_word)
    assert decoded == "TES"

    # Ingest word
    mgr.ingest_rx_word(raw_word, "356")
    state = mgr.get_state()
    assert len(state["normal_messages"]) > 0
    assert any("TES" in m["text"] for m in state["normal_messages"])


def test_cfds_discrete_mode_11_fields():
    """Verify Slide 10 Discrete Mode 11 failure fields dynamic population."""
    mgr = CfdsProtocolManager()
    mgr.select_lru("012")  # ADF

    # Initially empty
    state = mgr.get_state()
    assert state["discrete_has_data"] is False
    assert state["discrete_fields"]["failure_number"] == ""

    # Simulate realistic discrete fault
    res = mgr.simulate_test_scenario("DISCRETE", "012")
    assert res["discrete_has_data"] is True
    assert res["discrete_fields"]["failure_number"] == "1"
    assert "ADF" in res["discrete_fields"]["failure_type_string"]
    assert res["discrete_fields"]["witness_position"] == "CAPT"
    assert res["discrete_fields"]["witness_side"] == "LEFT"
    assert res["discrete_fields"]["suspect1_position"] == "MAIN RACK"


def test_cfds_rest_api_endpoints(client: TestClient):
    """Verify FastAPI endpoints under /api/arinc/cfds/*."""
    # 1. State
    r = client.get("/api/arinc/cfds/state")
    assert r.status_code == 200
    data = r.json()
    assert "lru_table" in data
    assert len(data["lru_table"]) == 19

    # 2. Select LRU
    r = client.post("/api/arinc/cfds/select-lru", json={"code": "010"})
    assert r.status_code == 200
    assert r.json()["selected_lru"]["short"] == "ILS"

    # 3. Slide navigation
    r = client.post("/api/arinc/cfds/slide", json={"slide": "interactive_0048"})
    assert r.status_code == 200
    assert r.json()["current_slide"] == "interactive_0048"

    # 4. Flight phase
    r = client.post("/api/arinc/cfds/flight-phase", json={"phase": "AIR"})
    assert r.status_code == 200
    assert r.json()["flight_phase_mode"] == "AIR"

    # 5. Key command
    r = client.post("/api/arinc/cfds/key", json={"key": "1L"})
    assert r.status_code == 200
    assert r.json()["last_tx_command"]["key"] == "1L"

    # 6. Simulate scenario
    r = client.post("/api/arinc/cfds/simulate", json={"mode": "MENU", "lru_code": "010"})
    assert r.status_code == 200
    assert "ILS" in r.json()["mcdu_status"]

    # 7. Clear RX
    r = client.post("/api/arinc/cfds/clear", json={"mode": "menu"})
    assert r.status_code == 200


def test_cfds_dme_authentic_menu_navigation_simulation():
    """Verify authentic 16-screen 709 DME CFDS menu simulation tree and interactive key navigation."""
    mgr = CfdsProtocolManager(simulation_mode=True)
    mgr.select_lru("009")  # 709 DME

    # 1. Entering Menu Mode ABD0018 immediately loads DME root menu via Label 356
    res = mgr.set_slide("menu_0018")
    assert res["current_slide"] == "menu_0018"
    assert res["mcdu_has_data"] is True
    assert res["has_data"] is True
    assert "DME-0" in res["lines"][0]
    assert "<LAST LEG REPORT" in res["lines"][2]
    assert "<PREVIOUS LEGS REPORT" in res["lines"][4]
    assert "<LRU IDENTIFICATION" in res["lines"][6]
    assert "<TEST" in res["lines"][8]
    assert "<SHOP DATA" in res["lines"][10]
    assert "<RETURN" in res["lines"][12]

    # 2. Press 1 -> last_leg, 6 -> root
    res1 = mgr.send_key_command("1")
    assert res1["dme_current_screen"] == "last_leg"
    assert "34-51-33" in "\n".join(res1["lines"])
    assert mgr.send_key_command("6")["dme_current_screen"] == "root"

    # 3. Press 2 -> prev_legs, 6 -> root
    res2 = mgr.send_key_command("2")
    assert res2["dme_current_screen"] == "prev_legs"
    assert "-01 jan00 0000 34-51-33" in "\n".join(res2["lines"])
    assert mgr.send_key_command("6")["dme_current_screen"] == "root"

    # 4. Press 3 -> lru_id, 6 -> root; 4 -> test, 6 -> root
    res3 = mgr.send_key_command("3")
    assert res3["dme_current_screen"] == "lru_id"
    assert "822-0329-001" in "\n".join(res3["lines"])
    assert mgr.send_key_command("6")["dme_current_screen"] == "root"

    res4 = mgr.send_key_command("4")
    assert res4["dme_current_screen"] == "test"
    assert "34-51-23" in "\n".join(res4["lines"])
    assert mgr.send_key_command("6")["dme_current_screen"] == "root"

    # 5. Shop Data -> Enter Shop Visit -> confirm -> Return -> Display Fault -> Last Leg -> Return to Display Fault
    res_shop = mgr.send_key_command("5")
    assert res_shop["dme_current_screen"] == "shop_data"
    assert mgr.send_key_command("2")["dme_current_screen"] == "shop_visit"
    res_sv = mgr.send_key_command("2")
    assert "SHOP VISIT ENTERED" in "\n".join(res_sv["lines"])
    assert mgr.send_key_command("6")["dme_current_screen"] == "shop_data"

    assert mgr.send_key_command("3")["dme_current_screen"] == "display_fault"
    assert mgr.send_key_command("2")["dme_current_screen"] == "last_leg"
    assert mgr.send_key_command("6")["dme_current_screen"] == "display_fault"
    assert mgr.send_key_command("6")["dme_current_screen"] == "shop_data"

    # 6. Software ID & Special Functions
    res_sw = mgr.send_key_command("4")
    assert res_sw["dme_current_screen"] == "software_id"
    assert "829-4471-013" in "\n".join(res_sw["lines"])
    assert mgr.send_key_command("6")["dme_current_screen"] == "shop_data"

    res_sf = mgr.send_key_command("5")
    assert res_sf["dme_current_screen"] == "special_func"
    assert "FIXED XMIT RATE-OFF" in "\n".join(res_sf["lines"])
    res_sf_on = mgr.send_key_command("4")
    assert "FIXED XMIT RATE-ON" in "\n".join(res_sf_on["lines"])

    # Set RCVR
    assert mgr.send_key_command("2")["dme_current_screen"] == "set_rcvr"
    res_rcvr = mgr.send_key_command("C")
    assert "*75X>" in "\n".join(res_rcvr["lines"])
    assert mgr.send_key_command("6")["dme_current_screen"] == "special_func"

    # AGC Test (default 00 -> FF -> A0 -> 00)
    res_agc = mgr.send_key_command("B")
    assert res_agc["dme_current_screen"] == "agc_test"
    assert "current value  agc [00]" in res_agc["lines"][4]
    assert "current value  agc [FF]" in mgr.send_key_command("3")["lines"][4]
    assert "current value  agc [A0]" in mgr.send_key_command("4")["lines"][4]
    assert "current value  agc [00]" in mgr.send_key_command("5")["lines"][4]
    assert mgr.send_key_command("6")["dme_current_screen"] == "special_func"

    # Bus In & Self-Test TGT & Menu 2 -> NVM Result
    assert mgr.send_key_command("3")["dme_current_screen"] == "bus_in"
    assert "bus a   66" in "\n".join(mgr.send_key_command("5")["lines"])
    assert mgr.send_key_command("6")["dme_current_screen"] == "special_func"

    res_tgt = mgr.send_key_command("5")
    assert res_tgt["dme_current_screen"] == "self_test_tgt"
    assert "826b" in "\n".join(res_tgt["lines"])
    assert mgr.send_key_command("6")["dme_current_screen"] == "special_func"

    assert mgr.send_key_command("E")["dme_current_screen"] == "menu_2"
    res_nvm = mgr.send_key_command("2")
    assert res_nvm["dme_current_screen"] == "nvm_result"
    assert "0000 bytes bad" in "\n".join(res_nvm["lines"])


def test_cfds_e2e_api_dme_16_screens_and_other_lrus(client: TestClient):
    """End-to-end TestClient flow simulating exact browser clicks on 709 DME & other LRUs."""
    # --- A. 709 DME complete sequence ---
    r = client.post("/api/arinc/cfds/select-lru", json={"code": "009"})
    assert r.status_code == 200
    r = client.post("/api/arinc/cfds/op-mode", json={"slide": "menu_0018"})
    assert r.status_code == 200
    d = r.json()
    assert d["has_data"] is True
    txt = "\n".join(d["lines"])
    assert "DME-0" in txt
    assert "<LAST LEG REPORT" in txt
    assert "<SHOP DATA" in txt

    steps = [
        ("1", "34-51-33"),
        ("6", "<LAST LEG REPORT"),
        ("3", "822-0329-001"),
        ("6", "<LRU IDENTIFICATION"),
        ("4", "34-51-23"),
        ("6", "<TEST"),
        ("5", "<SOFTWARE ID"),
        ("4", "829-4471-013"),
        ("6", "<SPECIAL FUNCTIONS"),
        ("5", "special function menu"),
        ("4", "FIXED XMIT RATE-ON"),
        ("B", "current value  agc [00]"),
        ("3", "current value  agc [FF]"),
        ("4", "current value  agc [A0]"),
        ("5", "current value  agc [00]"),
        ("6", "MENU 2>"),
        ("E", "FORMAT NON VOLATILE"),
        ("2", "0000 bytes bad"),
    ]
    for key, expected in steps:
        kr = client.post("/api/arinc/cfds/key", json={"key": key})
        assert kr.status_code == 200
        kd = kr.json()
        assert kd["has_data"] is True
        assert expected in "\n".join(kd["lines"]), f"Expected {expected!r} after key {key!r}"

    # --- B. Other LRUs + MANUAL ENTRY across menu_0018 & interactive_0048 ---
    targets = [
        ("007", None, None, "RALT-1"),
        ("011", None, None, "VOR-1"),
        ("050", None, None, "VDR-1"),
        ("02A", None, None, "LRU-02A"),
    ]
    for code, name, short, expected_hdr in targets:
        sr = client.post("/api/arinc/cfds/select-lru", json={"code": code, "name": name, "short": short})
        assert sr.status_code == 200

        for slide in ("menu_0018", "interactive_0048"):
            om = client.post("/api/arinc/cfds/op-mode", json={"slide": slide})
            assert om.status_code == 200
            od = om.json()
            assert od["has_data"] is True
            assert expected_hdr in od["lines"][0]

            r1 = client.post("/api/arinc/cfds/key", json={"key": "1"})
            assert r1.status_code == 200
            assert "LAST LEG REPORT" in "\n".join(r1.json()["lines"])

            assert client.post("/api/arinc/cfds/key", json={"key": "6"}).status_code == 200
            r3 = client.post("/api/arinc/cfds/key", json={"key": "3"})
            assert r3.status_code == 200
            assert f"EQ CODE: {code}" in "\n".join(r3.json()["lines"])

            assert client.post("/api/arinc/cfds/key", json={"key": "6"}).status_code == 200
            r4 = client.post("/api/arinc/cfds/key", json={"key": "4"})
            assert r4.status_code == 200
            assert "TEST OK" in "\n".join(r4.json()["lines"])

            r6 = client.post("/api/arinc/cfds/key", json={"key": "6"})
            assert r6.status_code == 200
            assert "<GROUND SCANNING" in "\n".join(r6.json()["lines"])


def test_cfds_hardware_mode_pure_dynamic_rx():
    """Verify hardware mode (simulation_mode=False / is_cfds_simulation_active()==False)
    does not generate simulated pages; relies 100% on physical Label 356 packets arriving.
    """
    from ate_platform.web.arinc_session import ArincSession

    sess = ArincSession(simulation=True)
    # Force connected physical Ballard state with simulation disabled
    sess.simulation_mode = False
    sess._sim_override = False
    sess.hardware_info = {
        "simulated": False,
        "cores": [{"core": 0, "open_ok": True, "count": 16}],
    }
    import ate_platform.web.arinc_session as sess_mod
    orig_bti = sess_mod.HAS_BTIDRIVER
    orig_force = sess_mod.force_simulation
    try:
        sess_mod.HAS_BTIDRIVER = True
        sess_mod.force_simulation = lambda: False
        assert sess.is_cfds_simulation_active() is False
    finally:
        sess_mod.HAS_BTIDRIVER = orig_bti
        sess_mod.force_simulation = orig_force

    mgr = CfdsProtocolManager(simulation_mode=False)
    mgr.select_lru("009")

    # In hardware mode, entering menu does not auto-populate simulated data
    res = mgr.set_slide("menu_0018")
    assert res["mcdu_has_data"] is False
    assert res["has_data"] is False
    assert all(line.strip() == "" for line in res["mcdu_lines"])

    # Transmitting a key sends Label 227 without changing MCDU screen
    res_key = mgr.send_key_command("1")
    assert res_key["last_tx_command"]["key"] == "1"
    assert res_key["has_data"] is False

    # Once physical Label 356 arrives on bus, has_data becomes True
    c1, c2, c3 = "B", "I", "T"
    b1, b2, b3 = ord(c1) & 0x7F, ord(c2) & 0x7F, ord(c3) & 0x7F
    data_19 = b1 | (b2 << 7) | ((b3 & 0x1F) << 14)
    ssm_val = (b3 >> 5) & 0x03
    lbl356_word = parse_label("356") | (data_19 << 10) | (ssm_val << 29)

    mgr.ingest_rx_word(lbl356_word, "356")
    res_rx = mgr.get_state()
    assert res_rx["mcdu_has_data"] is True
    assert res_rx["has_data"] is True
    assert "BIT" in res_rx["lines"][0]


def test_cfds_sim_mode_toggle_on_real_hw_and_local_sim(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, client: TestClient
):
    """Verify POST /api/arinc/cfds/sim-mode toggle both when hardware_connected=True and local sim."""
    import ate_platform.web.arinc_session as sess_mod
    from ate_platform.web.arinc_session import ArincSession

    # --- A. Simulate real Ballard hardware server (like 10.11.11.2) ---
    sess = ArincSession(simulation=True)
    sess.simulation_mode = False
    sess._sim_override = False
    sess.hardware_info = {
        "simulated": False,
        "cores": [{"core": 0, "open_ok": True, "count": 16}],
    }
    orig_bti = sess_mod.HAS_BTIDRIVER
    orig_force = sess_mod.force_simulation
    try:
        sess_mod.HAS_BTIDRIVER = True
        sess_mod.force_simulation = lambda: False

        # Default: False when physical Ballard hardware is active
        assert sess.is_cfds_simulation_active() is False

        # Enter DME-0 Menu Mode while SIM is OFF -> empty waiting screen
        sess.select_cfds_lru("009")
        r_off = sess.set_cfds_slide("menu_0018")
        assert r_off["is_simulation"] is False
        assert r_off["has_data"] is False

        # Enable CFDS SIM ON -> immediately populates DME-0 root screen
        r_on = sess.set_cfds_sim_mode(True)
        assert r_on["is_simulation"] is True
        assert r_on["has_data"] is True
        assert "DME-0" in r_on["lines"][0]
        assert "<LAST LEG REPORT" in r_on["lines"][2]

        # Navigate keys 1 -> 5 -> 6 while SIM ON
        assert "34-51-33" in "\n".join(sess.send_cfds_key("1")["lines"])
        assert sess.send_cfds_key("6")["current_screen"] == "root"
        assert "shop data" in "\n".join(sess.send_cfds_key("5")["lines"]).lower()
        assert sess.send_cfds_key("6")["current_screen"] == "root"

        # Test 707 LRA as well
        sess.select_cfds_lru("007")
        r_lra = sess.set_cfds_slide("menu_0018")
        assert r_lra["has_data"] is True
        assert "RALT-1" in r_lra["lines"][0]

        # Disable CFDS SIM OFF -> clears buffer, returns to hardware listen mode
        r_back_off = sess.set_cfds_sim_mode(False)
        assert r_back_off["is_simulation"] is False
        assert r_back_off["has_data"] is False
        assert all(line.strip() == "" for line in r_back_off["lines"])
        # Physical hardware mode for other ARINC modes stays intact
        assert sess._sim_override is False
    finally:
        sess_mod.HAS_BTIDRIVER = orig_bti
        sess_mod.force_simulation = orig_force

    # --- B. End-to-end REST endpoint toggle on local sim TestClient (True -> False -> True) ---
    assert client.post("/api/arinc/cfds/select-lru", json={"code": "009"}).status_code == 200
    assert client.post("/api/arinc/cfds/op-mode", json={"slide": "menu_0018"}).status_code == 200

    res1 = client.post("/api/arinc/cfds/sim-mode", json={"enabled": True})
    assert res1.status_code == 200
    assert res1.json()["is_simulation"] is True
    assert res1.json()["has_data"] is True
    assert "DME-0" in res1.json()["lines"][0]

    # Toggle OFF via API -> clears simulated MCDU buffer
    res2 = client.post("/api/arinc/cfds/sim-mode", json={"enabled": False})
    assert res2.status_code == 200
    assert res2.json()["is_simulation"] is False
    assert res2.json()["has_data"] is False

    # Snapshot (/api/arinc/status & /api/arinc/snapshot) reflects cfds.is_simulation == False
    snap_res = client.get("/api/arinc/snapshot")
    assert snap_res.status_code == 200
    assert snap_res.json()["cfds"]["is_simulation"] is False

    # Toggle back ON -> repopulates active screen + keys navigate
    res3 = client.post("/api/arinc/cfds/sim-mode", json={"enabled": True})
    assert res3.status_code == 200
    assert res3.json()["is_simulation"] is True
    assert res3.json()["has_data"] is True
    assert "DME-0" in res3.json()["lines"][0]
    assert "34-51-33" in "\n".join(client.post("/api/arinc/cfds/key", json={"key": "1"}).json()["lines"])
    assert "<LAST LEG REPORT" in "\n".join(client.post("/api/arinc/cfds/key", json={"key": "6"}).json()["lines"])


def test_cfds_refresh_endpoint_sim_on_and_sim_off(client: TestClient):
    """Verify POST /api/arinc/cfds/refresh behavior in both SIM: ON and SIM: OFF modes."""
    # Select 709 DME and navigate into shop_data sub-screen
    assert client.post("/api/arinc/cfds/select-lru", json={"code": "009"}).status_code == 200
    assert client.post("/api/arinc/cfds/op-mode", json={"slide": "menu_0018"}).status_code == 200
    assert client.post("/api/arinc/cfds/sim-mode", json={"enabled": True}).status_code == 200
    assert client.post("/api/arinc/cfds/key", json={"key": "5"}).json()["current_screen"] == "shop_data"

    # Refresh while SIM: ON keeps active screen (shop_data) and re-emits clean lines
    r_sim_on = client.post("/api/arinc/cfds/refresh")
    assert r_sim_on.status_code == 200
    d_on = r_sim_on.json()
    assert d_on["is_simulation"] is True
    assert d_on["has_data"] is True
    assert d_on["current_screen"] == "shop_data"
    assert "<ENTER SHOP VISIT" in "\n".join(d_on["lines"])

    # Switch SIM: OFF and verify refresh clears buffer & sends Label 227 re-request word
    assert client.post("/api/arinc/cfds/sim-mode", json={"enabled": False}).status_code == 200
    r_sim_off = client.post("/api/arinc/cfds/refresh")
    assert r_sim_off.status_code == 200
    d_off = r_sim_off.json()
    assert d_off["is_simulation"] is False
    assert d_off["has_data"] is False
    assert all(line.strip() == "" for line in d_off["lines"])
    assert d_off["last_tx_command"]["key"] == "REFRESH"
    assert d_off["last_tx_command"]["equipment_code"] == "009"
    assert d_off["last_tx_command"]["hex_32"].startswith("0x")

