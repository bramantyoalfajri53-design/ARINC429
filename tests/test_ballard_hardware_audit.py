import os
from ate_platform.device.arinc429 import audit_ballard_hardware
from ate_platform.web.arinc_session import ArincSession

def test_hardware_audit_simulation():
    info = audit_ballard_hardware(0)
    assert "cores" in info
    assert len(info["cores"]) >= 2
    assert info["active_core"] == 0
    assert "P1" in info["active_port"]
    assert "222-441-000" in info.get("warning", "") or "441" in info.get("product_pn", "")

def test_arinc_session_hardware_info():
    sess = ArincSession(card=0, simulation=True)
    snap = sess.snapshot()
    assert "hardware" in snap
    hw = snap["hardware"]
    assert hw["active_core"] == 0
    assert "cores" in hw

def test_dme_handshake_diagnostic_checklist_hardware():
    sess = ArincSession(card=0, simulation=True)
    diag = sess.dme_handshake_diagnostic(bus="A", arm_stimulus=False)
    assert "hardware" in diag
    items = [c["item"] for c in diag["checklist"]]
    assert any("Ballard OmniBus II" in item for item in items)
    # Check that Ballard connector is the first check in the checklist
    assert "Ballard OmniBus II PXI Front Panel Connector" in items[0]

def test_channel_activity_and_selftest():
    sess = ArincSession(card=0, simulation=True)
    activity = sess.get_channel_activity()
    # Check all 8 RX transceivers (0..7) and 8 TX transceivers (16..23)
    assert len(activity) == 16
    channels = {item["channel"]: item for item in activity}
    for ch in range(8):
        assert ch in channels
        assert channels[ch]["type"] == "RX"
        assert "db37_pins" in channels[ch]
    for ch in range(16, 24):
        assert ch in channels
        assert channels[ch]["type"] == "TX"
        assert "db37_pins" in channels[ch]

    # Test hardware selftest loopback
    st = sess.hardware_selftest()
    assert st["overall_status"] == "PASS"
    assert "buses" in st
    assert len(st["buses"]) == 4

def test_vhf2100_adc_decoding_and_label202_mem_bf():
    from ate_platform.device.arinc_profile import decode_vhf2100_adc_353
    from ate_platform.device.label_dict import decode_received

    # Test VHF-2100 Label 353 ADC decoding
    # Channel 0 (MIC AUDIO SAMPLE 1), count 1000
    # bits 24-28 = channel (0), bits 10-21 = count (1000)
    data_bits = (0 << 14) | 1000
    raw_word = (data_bits << 10) | 0xEB
    adc_info = decode_vhf2100_adc_353(raw_word)
    assert adc_info is not None
    assert adc_info["channel_num"] == 0
    assert adc_info["param"] == "MIC AUDIO SAMPLE 1"
    assert "V" in adc_info["units"]
    expected_val = round(((1000 * 625) / 1024) / 1000.0, 3)
    assert abs(adc_info["value"] - expected_val) < 0.001

    # Test Label 202 bit 11 MEM and bit 12 B/F
    # bit 11 (mask 1 << 10), bit 12 (mask 1 << 11)
    word_mem_bf = 0x82 | (1 << 10) | (1 << 11) | (3 << 29)
    rec = decode_received(word_mem_bf)
    assert rec["label_octal"] == "202"
    assert rec["mem"] == "ON"
    assert rec["bf"] == "F"

    # When bit 11=0 (OFF) and bit 12=0 (B)
    word_off_b = 0x82 | (3 << 29)
    rec2 = decode_received(word_off_b)
    assert rec2["mem"] == "OFF"
    assert rec2["bf"] == "B"

def test_api_channel_activity_and_selftest():
    import os
    from fastapi.testclient import TestClient
    from ate_platform.web.app import create_app

    os.environ["ATE_UI_PIN"] = "2468"
    app = create_app(simulation=True)
    with TestClient(app) as client:
        # Login
        r_login = client.post("/api/auth/login", json={"pin": "2468"})
        assert r_login.status_code == 200

        res_act = client.get("/api/arinc/channels/activity")
        assert res_act.status_code == 200
        act_data = res_act.json()
        assert len(act_data) == 16

        res_st = client.post("/api/arinc/hardware/selftest")
        assert res_st.status_code == 200
        st_data = res_st.json()
        assert st_data["overall_status"] == "PASS"

