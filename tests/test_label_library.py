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
