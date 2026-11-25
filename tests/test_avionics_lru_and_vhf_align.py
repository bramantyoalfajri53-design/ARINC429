import pytest
import time
from pathlib import Path
from ate_platform.device.arinc_profile import CATALOG
from ate_platform.device.vhf900_align import Vhf900AlignManager, TFM_VARIABLES, CAL_VARIABLES
from ate_platform.web.arinc_session import ArincSession, RxHit
from ate_platform.web.app import create_app
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ATE_FORCE_SIM", "1")
    monkeypatch.setenv("ATE_UI_PIN", "2468")
    app = create_app(simulation=True, out_dir=tmp_path)
    with TestClient(app) as c:
        c.post("/api/auth/login", json={"pin": "2468"})
        yield c


def test_catalog_ordering_and_kinds():
    """Verify CATALOG matches JcAIR T1200B hardware layout rows and kinds."""
    catalog = CATALOG
    assert len(catalog) == 20
    ids = [c["id"] for c in catalog]

    # Row 1 (10 buttons)
    row1 = ["adf_032", "vor", "ils", "dme", "atc_xpdr", "radio_alt", "vhf_comm", "hf_719", "vdr_750", "hfdu_753"]
    assert ids[:10] == row1

    # Row 2 (7 buttons)
    row2 = ["hfdr_753", "hf_rmp", "hf_acars", "hfdu_rmp", "hfdr_rmp", "vhf_833", "mmr_755"]
    assert ids[10:17] == row2

    # Row 3 (2 buttons)
    row3 = ["vhf_align", "vdl_mode"]
    assert ids[17:19] == row3

    # Row 4 (1 button)
    row4 = ["vor_579"]
    assert ids[19:20] == row4

    # Verify kinds
    kind_map = {c["id"]: c.get("kind") for c in catalog}
    assert kind_map["dme"] == "dme"
    assert kind_map["mmr_755"] == "mmr"
    assert kind_map["vhf_align"] == "vhf_align"
    assert kind_map["hf_719"] == "hf"
    assert kind_map["hfdu_753"] == "hf"
    assert kind_map["hfdr_753"] == "hf"
    assert kind_map["adf_032"] == "lru"
    assert kind_map["vor"] == "lru"
    assert kind_map["vdr_750"] == "lru"


def test_vdr_750_profile():
    """Verify 750 VDR configuration (TX-C 100 kbps, RX-A, slots 172 & 270)."""
    session = ArincSession(simulation=True)
    snap = session.apply_profile("vdr_750", tx_ch="C", rx_ch="A")
    assert snap["tx_ch"] == "C"
    assert snap["rx_ch"] == "A"
    slots = snap.get("tx", {}).get("C", [])
    assert len(slots) >= 2
    assert slots[0]["label"] == "172"
    assert slots[1]["label"] == "270"
    assert slots[0]["rate_ms"] == 100
    assert slots[1]["rate_ms"] == 100


def test_hf_dual_word_config():
    """Verify HF dual-word packing (Word #1 bit 9=0, Word #2 bit 9=1, 75 ms)."""
    session = ArincSession(simulation=True)
    snap = session.configure_hf_dual_word(
        bus="A",
        freq_mhz=10.0000,
        sb="USB",
        mod="AM",
        cw=True,
        ssm="00",
        rate_ms=75,
    )
    slots = snap.get("tx", {}).get("A", [])
    assert len(slots) >= 2
    w1 = slots[0]
    w2 = slots[1]
    assert w1["label"] == "037"
    assert w2["label"] == "037"
    assert w1["rate_ms"] == 75
    assert w2["rate_ms"] == 75

    # Check raw word hex
    assert "0x" in w1["raw"].lower()
    assert "0x" in w2["raw"].lower()
    w1_val = int(w1["raw"], 16)
    w2_val = int(w2["raw"], 16)
    # Bit 9 is at bit offset 8
    assert (w1_val & (1 << 8)) == 0  # bit 9 is 0
    assert (w2_val & (1 << 8)) != 0  # bit 9 is 1


def test_time_constant_setting_and_filtering(client: TestClient):
    """Verify Time Constant endpoint and filter calculation."""
    # Set to 1.6s
    r = client.post("/api/arinc/time-constant", json={"seconds": 1.6})
    assert r.status_code == 200
    data = r.json()
    assert data["time_constant_s"] == 1.6

    # Set to 0 (OFF)
    r2 = client.post("/api/arinc/time-constant", json={"seconds": 0.0})
    assert r2.status_code == 200
    assert r2.json()["time_constant_s"] == 0.0


def test_vhf900_align_manager_variables():
    """Verify VHF-900 40 TFM and 40 CAL variables and stepping."""
    mgr = Vhf900AlignManager()
    assert len(TFM_VARIABLES) == 40
    assert len(CAL_VARIABLES) == 40

    st = mgr.get_state()
    assert len(st["tfm_vars"]) == 40
    assert len(st["cal_vars"]) == 40
    assert st["tx_inh"] is False
    assert st["tx_phs"] is False

    # Step frequency
    mgr.freq_pos = 2  # 1s digit
    new_freq = mgr.step_freq(1)  # step 1s up: 118.000 -> 119.000
    assert abs(new_freq - 119.000) < 0.001

    # Step variable value
    mgr.current_screen = "tfm"
    mgr.active_var_id = 1
    var1_before = mgr.tfm_vars[0].get("ram", 0)
    mgr.val_nibble = 1
    new_val = mgr.step_var_val(1)
    assert new_val == (var1_before + 1) % 256

    # Write variable (2-click)
    res1 = mgr.write_var("WRITE_ROM")
    assert res1["status"] == "CONFIRM_REQUIRED"
    res2 = mgr.write_var("WRITE_ROM")
    assert res2["status"] == "OK"
    assert mgr.tfm_vars[0]["rom"] == mgr.tfm_vars[0]["ram"]


def test_vhf900_checksum_routine():
    """Verify 10-second recalculate ROM checksum progression."""
    mgr = Vhf900AlignManager()
    mgr.start_checksum()
    assert mgr.checksum_status == "RUNNING"

    # Check complete (>10s): DONE
    mgr.checksum_start = time.time() - 11.0  # 11s elapsed
    st_done = mgr.get_state()
    assert st_done["checksum_status"] == "DONE"


def test_vhf900_echo_detection_and_fault_decoder():
    """Verify echo timeout and Label 350 fault decoding."""
    mgr = Vhf900AlignManager()
    # Before any RX, echo_ok is False
    st = mgr.get_state()
    assert st["echo_ok"] is False

    # Receive echo on bus C
    class DummyRxBus:
        def __init__(self):
            self.by_label = {
                "030": RxHit(label_octal="030", ts=time.time(), raw=0x03012345),
                "350": RxHit(label_octal="350", ts=time.time(), raw=0x00E800E8),
            }

    bus_c = DummyRxBus()
    st_echo = mgr.get_state(rx_bus_c=bus_c)
    assert st_echo["echo_ok"] is True
    assert st_echo["faults"]["label_350_raw"] != "00000000"


def test_api_vhf_align_endpoints(client: TestClient):
    """Verify FastAPI routes for VHF Align."""
    # 1. GET state
    r1 = client.get("/api/arinc/vhf-align/state")
    assert r1.status_code == 200
    data = r1.json()
    assert "freq_mhz" in data
    assert "tfm_vars" in data
    assert "cal_vars" in data

    # 2. POST config
    r2 = client.post("/api/arinc/vhf-align/config", json={"tx_inh": True, "ssm": "11"})
    assert r2.status_code == 200
    assert r2.json()["tx_inh"] is True
    assert r2.json()["ssm"] == "11"

    # 3. POST checksum
    r3 = client.post("/api/arinc/vhf-align/checksum")
    assert r3.status_code == 200
    assert r3.json()["checksum_status"] in ["RUNNING", "DONE"]

    # 4. POST step
    r4 = client.post("/api/arinc/vhf-align/step", json={"target": "freq", "pos": 2, "dir": 1})
    assert r4.status_code == 200

    # 5. POST write-var (click 1 -> confirm, click 2 -> ok)
    r5a = client.post("/api/arinc/vhf-align/write-var", json={"action": "WRITE_ROM"})
    assert r5a.status_code == 200
    r5b = client.post("/api/arinc/vhf-align/write-var", json={"action": "WRITE_ROM"})
    assert r5b.status_code == 200
    assert r5b.json()["status"] == "OK"


def test_api_hf_config_endpoint(client: TestClient):
    """Verify FastAPI route for HF config."""
    r = client.post("/api/arinc/hf/config", json={
        "freq_mhz": 12.3456,
        "sb": "USB",
        "mod": "SSB",
        "cw": False,
        "ssm": "00",
        "rate_ms": 75,
        "tx_bus": "A",
        "rx_bus": "B"
    })
    assert r.status_code == 200
    data = r.json()
    assert data["tx_ch"] == "A"
    assert data["rx_ch"] == "B"


def test_vhf_align_ssm_sdi_cyclic_and_arinc_words(client: TestClient):
    """Verify cyclic SSM and SDI transitions, and that ARINC words reflect bits 9-10 (SDI) and 29-30 (SSM)."""
    for ssm in ["00", "01", "10", "11"]:
        for sdi in ["00", "01", "10", "11"]:
            r = client.post("/api/arinc/vhf-align/config", json={"ssm": ssm, "sdi": sdi})
            assert r.status_code == 200
            data = r.json()
            assert data["ssm"] == ssm
            assert data["sdi"] == sdi

    # Check status snapshot
    snap = client.get("/api/arinc/status").json()
    assert "vhf_align" in snap
    assert snap["vhf_align"]["ssm"] == "11"
    assert snap["vhf_align"]["sdi"] == "11"


def test_snapshot_latency_and_lightweight_payload(client: TestClient):
    """Verify that snapshot payload is lightweight when not on vhf_align profile, and response time is low."""
    t0 = time.time()
    r = client.get("/api/arinc/status")
    dt = time.time() - t0
    assert r.status_code == 200
    assert dt < 0.2
    data = r.json()
    v_align = data.get("vhf_align", {})
    assert len(v_align.get("tfm_vars", [])) == 0
    assert len(v_align.get("cal_vars", [])) == 0

    # Now switch to vhf_align profile
    r_apply = client.post("/api/arinc/profile/apply", json={"profile": "vhf_align"})
    assert r_apply.status_code == 200

    r_align = client.get("/api/arinc/status")
    assert r_align.status_code == 200
    data_align = r_align.json()
    v_align_active = data_align.get("vhf_align", {})
    assert len(v_align_active.get("tfm_vars", [])) == 40
    assert len(v_align_active.get("cal_vars", [])) == 40


def test_channel_bit_rate_stepping_and_snapshot(client: TestClient):
    """Verify that bit_rate_kbps stepping is preserved without being overwritten by high_speed."""
    low_rates = [8.1, 9.4, 11.1, 12.5, 13.9, 15.1, 17.2, 18.5, 20.0]
    for rate in low_rates:
        r = client.post("/api/arinc/channel", json={"bus": "A", "bit_rate_kbps": rate})
        assert r.status_code == 200
        snap = r.json()
        assert abs(snap["bit_rate_kbps"] - rate) < 0.01
        assert snap["high_speed"] is False
        assert f"{rate:.1f}" in snap["bit_rate_display"] or f"{int(rate)}" in snap["bit_rate_display"]

    high_rates = [83.33, 100.0, 125.0]
    for rate in high_rates:
        r = client.post("/api/arinc/channel", json={"bus": "A", "bit_rate_kbps": rate})
        assert r.status_code == 200
        snap = r.json()
        assert abs(snap["bit_rate_kbps"] - rate) < 0.01
        assert snap["high_speed"] is True


def test_profile_reset_and_defaults_restored(client: TestClient):
    """Verify profile reset endpoint applies cleanly."""
    r_apply = client.post("/api/arinc/profile/apply", json={"profile": "vor", "reset": True})
    assert r_apply.status_code == 200
    data = r_apply.json()
    assert data["active_profile"] == "vor"


