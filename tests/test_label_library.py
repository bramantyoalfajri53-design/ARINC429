"""Label library built from the Aeroflex T1200 CSV (no hardware)."""

from __future__ import annotations

import csv

from ate_platform.device.label_dict import library_catalog, lookup_label
from ate_platform.device.arinc_profile import load_profile
from ate_platform.paths import REPO_ROOT


def test_library_covers_csv_octals():
    csv_path = REPO_ROOT / "docs" / "labels_and_default_data.csv"
    with csv_path.open(encoding="utf-8", newline="") as fh:
        octals = [str(row["LABEL"]).zfill(3) for row in csv.DictReader(fh)]
    lib = {row["label"] for row in library_catalog()}
    missing = [o for o in octals if o not in lib]
    assert not missing, missing
    assert len(library_catalog()) >= len(octals)


def test_library_vhf_and_mach_from_csv():
    vhf = lookup_label("030")
    assert vhf is not None
    assert vhf.funct == "VHF COMM"
    assert vhf.units == "MHZ"
    assert vhf.encoding == "bcd"
    assert vhf.eng_default == 118.0
    assert vhf.bcd_digits == 5
    assert vhf.rate_ms == 150
    mach = lookup_label("205")
    assert mach is not None
    assert mach.funct == "MACH"
    assert mach.encoding == "bnr"


def test_vor_profile_still_loads_tx_labels():
    vor = load_profile("vor")
    tx = [ls.label_octal for ls in vor.labels if ls.direction != "rx"]
    assert tx == ["034", "024", "027", "100", "110"]
    assert any(ls.label_octal == "222" for ls in vor.labels)


def test_library_complete_jcair_t1200b_labels_and_metadata():
    """Verify key Aeroflex JcAIR T1200B operational, CFDS, CMC, and VHF Align labels + metadata."""
    catalog = library_catalog()
    by_oct = {row["label"]: row for row in catalog}

    expected_octals = [
        "030", "031", "032", "033", "034", "035", "037", "047",
        "125", "126", "130", "131", "164", "165", "170", "172",
        "202", "205", "206", "227", "260", "350", "355", "356", "377",
    ]
    for oct_code in expected_octals:
        assert oct_code in by_oct, f"Missing T1200B label {oct_code}"
        item = by_oct[oct_code]
        for key in ("format", "units", "lru_group", "ssm_type", "range_text", "bit_layout"):
            assert key in item and item[key] is not None, f"{oct_code} missing {key}"

    assert by_oct["032"]["format"] == "BCD"
    assert by_oct["032"]["lru_group"] == "Nav (DME/VOR/ILS/ADF)"
    assert by_oct["164"]["format"] == "BNR"
    assert by_oct["164"]["lru_group"] == "LRA"
    assert by_oct["130"]["lru_group"] == "VHF Align"
    assert by_oct["227"]["lru_group"] == "CFDS / CMC"
    assert by_oct["356"]["format"] == "ISO #5"


def test_library_api_and_breadcrumb_stack_reset(tmp_path, monkeypatch):
    """Verify GET /api/arinc/library HTTP 200 and non-duplicating mode_select screen_stack reset."""
    from fastapi.testclient import TestClient
    from ate_platform.web.app import create_app

    monkeypatch.setenv("ATE_FORCE_SIM", "1")
    monkeypatch.setenv("ATE_UI_PIN", "2468")
    app = create_app(simulation=True, out_dir=tmp_path)
    with TestClient(app) as c:
        assert c.post("/api/auth/login", json={"pin": "2468"}).status_code == 200
        res = c.get("/api/arinc/library")
        assert res.status_code == 200
        rows = res.json()["labels"]
        assert len(rows) >= 149
        assert any(r["label"] == "356" and r["format"] == "ISO #5" for r in rows)

        # Entering CFDS then returning via screen/push mode_select must never duplicate Mode Select
        assert c.post("/api/arinc/mode", json={"mode": "cfds"}).status_code == 200
        r_back = c.post("/api/arinc/screen/push", json={"screen": "mode_select"})
        assert r_back.status_code == 200
        assert r_back.json()["screen_stack"] == ["mode_select"]

        # Same idempotent reset when exiting CMC
        assert c.post("/api/arinc/mode", json={"mode": "cmc"}).status_code == 200
        r_back2 = c.post("/api/arinc/screen/push", json={"screen": "mode_select"})
        assert r_back2.status_code == 200
        assert r_back2.json()["screen_stack"] == ["mode_select"]
