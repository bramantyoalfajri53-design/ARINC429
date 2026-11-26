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
