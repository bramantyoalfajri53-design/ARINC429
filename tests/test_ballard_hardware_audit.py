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
