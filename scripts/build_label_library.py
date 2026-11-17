#!/usr/bin/env python3
"""Build profiles/arinc/labels.yaml from docs/labels_and_default_data.csv.

Encoding is not in the CSV. Overlay known pack/unpack specs, then infer from NAME.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "docs" / "labels_and_default_data.csv"
OUT_PATH = ROOT / "profiles" / "arinc" / "labels.yaml"

# Proven encodings (current console). 205/206/207 follow CSV (MACH/ASPD), not HF RMP.
KNOWN: dict[str, dict] = {
    "017": {"encoding": "bcd", "bcd_scale": 10.0, "bcd_digits": 4},
    "024": {"encoding": "bcd", "bcd_scale": 10.0, "bcd_digits": 4},
    "027": {"encoding": "bcd", "bcd_scale": 10.0, "bcd_digits": 4},
    "030": {"encoding": "bcd", "bcd_scale": 1000.0, "bcd_digits": 5},
    "031": {"encoding": "bcd", "bcd_scale": 1.0, "bcd_digits": 4},
    "032": {"encoding": "bcd_freq_khz"},
    "033": {"encoding": "bcd", "bcd_scale": 100.0, "bcd_digits": 5},
    "034": {"encoding": "bcd", "bcd_scale": 100.0, "bcd_digits": 5},
    "035": {"encoding": "dme_freq", "bcd_scale": 100.0, "bcd_digits": 5},
    "037": {"encoding": "hf_pair"},
    "041": {"encoding": "bnr", "bnr": {"lsb": 0.000171661, "offset": 0.0, "bits": 20}},
    "042": {"encoding": "bnr", "bnr": {"lsb": 0.000171661, "offset": 0.0, "bits": 20}},
    "047": {"encoding": "bcd", "bcd_scale": 1000.0, "bcd_digits": 5},
    "100": {"encoding": "bnr", "bnr": {"lsb": 0.087890625, "offset": 0.0, "bits": 12}},
    "102": {"encoding": "bnr", "bnr": {"lsb": 1.0, "offset": 0.0, "bits": 16}},
    "105": {"encoding": "bnr", "bnr": {"lsb": 0.087890625, "offset": 0.0, "bits": 12}},
    "110": {"encoding": "bnr", "bnr": {"lsb": 0.087890625, "offset": 0.0, "bits": 12}},
    "162": {"encoding": "bnr", "bnr": {"lsb": 0.087890625, "offset": 0.0, "bits": 12}},
    "164": {"encoding": "bnr", "bnr": {"lsb": 0.125, "offset": 0.0, "bits": 16}},
    "165": {"encoding": "bcd", "bcd_scale": 10.0, "bcd_digits": 5},
    "173": {"encoding": "bnr", "bnr": {"lsb": 0.0001525879, "offset": 0.0, "bits": 12}},
    "174": {"encoding": "bnr", "bnr": {"lsb": 0.0001525879, "offset": 0.0, "bits": 12}},
    "202": {"encoding": "bnr", "bnr": {"lsb": 0.0048828125, "offset": 0.0, "bits": 16}},
    "203": {"encoding": "bnr", "bnr": {"lsb": 1.0, "offset": 0.0, "bits": 17}},
    "204": {"encoding": "bnr", "bnr": {"lsb": 1.0, "offset": 0.0, "bits": 17}},
    "205": {"encoding": "bnr", "bnr": {"lsb": 0.0000152587890625, "offset": 0.0, "bits": 16}},
    "206": {"encoding": "bnr", "bnr": {"lsb": 0.0625, "offset": 0.0, "bits": 16}},
    "207": {"encoding": "bnr", "bnr": {"lsb": 0.0625, "offset": 0.0, "bits": 16}},
    "210": {"encoding": "bnr", "bnr": {"lsb": 0.125, "offset": 0.0, "bits": 16}},
    "220": {"encoding": "bnr", "bnr": {"lsb": 1.0, "offset": 0.0, "bits": 17}},
    "222": {"encoding": "bnr", "bnr": {"lsb": 0.087890625, "offset": 0.0, "bits": 12}},
    "246": {"encoding": "iso5", "iso5_chars": 3, "units": "IDENT"},
    "247": {"encoding": "iso5", "iso5_chars": 3, "units": "IDENT"},
    "270": {"encoding": "raw"},
    "310": {"encoding": "bnr", "bnr": {"lsb": 0.000171661, "offset": 0.0, "bits": 20}},
    "311": {"encoding": "bnr", "bnr": {"lsb": 0.000171661, "offset": 0.0, "bits": 20}},
    "320": {"encoding": "bnr", "bnr": {"lsb": 0.087890625, "offset": 0.0, "bits": 12}},
    "357": {"encoding": "iso5", "iso5_chars": 3, "units": "IDENT"},
}

# Used by MMR / UTC / VDR but not in the T1200 default-data CSV.
EXTRAS: dict[str, dict] = {
    "040": {
        "funct": "SET ALT", "units": "FT", "sdi": 0, "ssm": "NML", "pads": "-",
        "rate_ms": 150, "encoding": "bnr", "bnr": {"lsb": 1.0, "offset": 0.0, "bits": 16},
        "eng": {"name": "SET ALT", "units": "FT", "default": 0},
    },
    "125": {
        "funct": "UTC", "units": "HHMM", "sdi": 0, "ssm": "NML", "pads": "-",
        "rate_ms": 150, "encoding": "bcd", "bcd_scale": 1.0, "bcd_digits": 6,
        "eng": {"name": "UTC", "units": "HHMM", "default": 0},
    },
    "150": {
        "funct": "UTC FINE", "units": "HHMMSS", "sdi": 0, "ssm": "NML", "pads": "-",
        "rate_ms": 150, "encoding": "bcd", "bcd_scale": 1.0, "bcd_digits": 6,
        "eng": {"name": "UTC FINE", "units": "HHMMSS", "default": 0},
    },
    "172": {
        "funct": "VDR SAL", "units": "HEX", "sdi": 0, "ssm": "NML", "pads": "-",
        "rate_ms": 150, "encoding": "raw",
        "eng": {"name": "VDR SAL", "units": "HEX", "default": 0},
    },
    "260": {
        "funct": "DATE", "units": "DMY", "sdi": 0, "ssm": "NML", "pads": "-",
        "rate_ms": 150, "encoding": "bcd", "bcd_scale": 1.0, "bcd_digits": 6,
        "eng": {"name": "DATE", "units": "DMY", "default": 0},
    },
}

SSM_MAP = {
    "NML": "NML", "PLS": "PLS", "INT": "INT", "UND": "UND",
    "N.": "NML", "E.": "NML", "-": "NML", "": "NML",
}


def parse_default(raw: str):
    s = (raw or "").strip()
    if not s or s == "-":
        return 0
    try:
        return float(s)
    except ValueError:
        return s


def parse_sdi(raw: str) -> int:
    s = (raw or "").strip()
    if s in {"", "--", "-"}:
        return 0
    if s == "11":
        return 3
    try:
        return int(s, 10)
    except ValueError:
        return 0


def pad_count(pads: str) -> int | None:
    s = (pads or "").strip()
    if s in {"", "-", "--"}:
        return None
    if all(c in "01" for c in s):
        return len(s)
    return None


def bits_from_pads(pads: str) -> int | None:
    n = pad_count(pads)
    if n is None:
        return None
    return max(8, min(19, 18 - n))


def angular_lsb(bits: int) -> float:
    return 180.0 / float(1 << max(1, bits - 1))


def bcd_from_units(units: str, default) -> dict:
    u = (units or "").upper()
    if u == "MHZ":
        scale = 1000.0 if isinstance(default, (int, float)) and float(default) >= 117 else 100.0
        return {"encoding": "bcd", "bcd_scale": scale, "bcd_digits": 5}
    if u == "FT":
        return {"encoding": "bcd", "bcd_scale": 10.0, "bcd_digits": 5}
    if u in {"DEG", "DG"}:
        return {"encoding": "bcd", "bcd_scale": 10.0, "bcd_digits": 4}
    if u in {"NM", "MN"}:
        return {"encoding": "bcd", "bcd_scale": 100.0, "bcd_digits": 5}
    if u in {"KT", "KTS"}:
        return {"encoding": "bcd", "bcd_scale": 1.0, "bcd_digits": 5}
    if u == "MACH":
        return {"encoding": "bcd", "bcd_scale": 1000.0, "bcd_digits": 5}
    if u == "FT/M":
        return {"encoding": "bcd", "bcd_scale": 1.0, "bcd_digits": 5}
    if u == "MB":
        return {"encoding": "bcd", "bcd_scale": 10.0, "bcd_digits": 5}
    if u == "INHG":
        return {"encoding": "bcd", "bcd_scale": 1000.0, "bcd_digits": 5}
    if u == "DEGC":
        return {"encoding": "bcd", "bcd_scale": 1.0, "bcd_digits": 5}
    if u in {"CLBS", "MIN"}:
        return {"encoding": "bcd", "bcd_scale": 1.0 if u == "CLBS" else 10.0, "bcd_digits": 5}
    return {"encoding": "bcd", "bcd_scale": 1.0, "bcd_digits": 5}


def bnr_from_units(units: str, name: str, bits: int) -> dict:
    u = (units or "").upper()
    n = (name or "").upper()
    bits = max(8, min(20, int(bits or 16)))
    if u in {"DEG", "DG"} or any(k in n for k in ("HDG", "TRK", "BRG", "ANGL", "AOA", "CRS")):
        if "LAT" in n or "LONG" in n:
            return {"encoding": "bnr", "bnr": {"lsb": 0.000171661, "offset": 0.0, "bits": max(bits, 20)}}
        return {"encoding": "bnr", "bnr": {"lsb": angular_lsb(bits), "offset": 0.0, "bits": bits}}
    if u == "FT":
        lsb = 0.125 if "RALT" in n else 1.0
        return {"encoding": "bnr", "bnr": {"lsb": lsb, "offset": 0.0, "bits": bits}}
    if u in {"KT", "KTS"}:
        lsb = 0.0625 if bits <= 14 else 0.125
        return {"encoding": "bnr", "bnr": {"lsb": lsb, "offset": 0.0, "bits": bits}}
    if u in {"NM", "MN"}:
        return {"encoding": "bnr", "bnr": {"lsb": 0.0048828125, "offset": 0.0, "bits": bits}}
    if u in {"MACH", "M", "MMAC"}:
        return {"encoding": "bnr", "bnr": {"lsb": 1.0 / 65536.0, "offset": 0.0, "bits": bits}}
    if u == "DDM":
        return {"encoding": "bnr", "bnr": {"lsb": 0.000152587890625, "offset": 0.0, "bits": bits}}
    if u == "FT/M":
        return {"encoding": "bnr", "bnr": {"lsb": 1.0, "offset": 0.0, "bits": bits}}
    if u == "G":
        return {"encoding": "bnr", "bnr": {"lsb": 0.000030517578125, "offset": 0.0, "bits": bits}}
    if u == "DEGC":
        return {"encoding": "bnr", "bnr": {"lsb": 0.25, "offset": 0.0, "bits": bits}}
    if u == "D/S":
        return {"encoding": "bnr", "bnr": {"lsb": 0.015625, "offset": 0.0, "bits": bits}}
    if u == "MB":
        return {"encoding": "bnr", "bnr": {"lsb": 0.01, "offset": 0.0, "bits": bits}}
    if u == "INHG":
        return {"encoding": "bnr", "bnr": {"lsb": 0.0001, "offset": 0.0, "bits": bits}}
    if u in {"RPM", "LB/H"}:
        return {"encoding": "bnr", "bnr": {"lsb": 1.0, "offset": 0.0, "bits": bits}}
    return {"encoding": "bnr", "bnr": {"lsb": 1.0, "offset": 0.0, "bits": bits}}


def _default_is_text(default) -> bool:
    if not isinstance(default, str):
        return False
    return any(c.isalpha() for c in default)


def infer_encoding(name: str, units: str, default, ssm: str = "", pads: str = "-") -> dict:
    n = (name or "").upper()
    u = (units or "").upper()
    ssm_u = (ssm or "").upper()
    bits = bits_from_pads(pads) or 16
    if "ID#" in n or n.startswith("ISO") or "ALPH" in n:
        return {"encoding": "iso5", "iso5_chars": 3}
    if u in {"HEX"} or n.startswith("DSCR") or n.startswith("MAIN") or n.startswith("TEST"):
        return {"encoding": "raw"}
    if _default_is_text(default) and u in {"DG", "DEG"}:
        return {"encoding": "raw"}
    if "BCD" in n or (ssm_u == "PLS" and u and u not in {"HEX", "IDENT"}):
        if "BNR" not in n:
            return bcd_from_units(u, default)
    if "BNR" in n or (ssm_u in {"NML", "N.", "E."} and u and u not in {"HEX", "IDENT", ""}):
        return bnr_from_units(u, n, bits)
    if u in {"MHZ"} and isinstance(default, float) and default > 50:
        scale = 1000.0 if default >= 117 else 100.0
        return {"encoding": "bcd", "bcd_scale": scale, "bcd_digits": 5}
    if u == "KHZ":
        return {"encoding": "bcd_freq_khz"}
    return {"encoding": "raw"}


def row_from_csv(row: dict) -> tuple[str, dict]:
    lab = str(row["LABEL"]).strip().zfill(3)
    name = str(row["NAME"]).strip()
    units = str(row.get("UNITS") or "").strip()
    if units == "-":
        units = ""
    default = parse_default(str(row.get("DEFAULT DATA") or ""))
    sdi = parse_sdi(str(row.get("SDI") or ""))
    pads = str(row.get("PADS") or "-").strip() or "-"
    ssm = SSM_MAP.get(str(row.get("SSM") or "").strip().upper(), "NML")
    try:
        rate_ms = int(str(row.get("RATE (ms)") or "150").strip())
    except ValueError:
        rate_ms = 150
    known = dict(KNOWN.get(lab) or infer_encoding(name, units, default, ssm, pads))
    if known.get("units"):
        units = known.pop("units")
    if known.get("encoding") == "iso5" and not units:
        units = "IDENT"
    if known.get("encoding") == "bnr":
        derived = bits_from_pads(pads)
        bnr = dict(known.get("bnr") or {})
        if derived is not None:
            old_bits = int(bnr.get("bits") or derived)
            bnr["bits"] = derived
            lsb = float(bnr.get("lsb") or 0.0)
            if units.upper() in {"DEG", "DG"} and abs(lsb - 0.087890625) < 1e-9 and derived != 12:
                bnr["lsb"] = angular_lsb(derived)
            elif old_bits != derived and units.upper() in {"DEG", "DG"}:
                bnr["lsb"] = angular_lsb(derived)
        known["bnr"] = bnr
    entry = {
        "funct": name,
        "units": units,
        "sdi": sdi,
        "ssm": ssm,
        "pads": pads,
        "rate_ms": rate_ms,
        "parity": "ODD",
        "encoding": known.pop("encoding", "raw"),
        "eng": {"name": name, "units": units, "default": default},
        "doc_page": str(row.get("DOC_PAGE") or "").strip(),
    }
    entry.update(known)
    return lab, entry


def main() -> int:
    labels: dict[str, dict] = {}
    with CSV_PATH.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            lab, entry = row_from_csv(row)
            labels[lab] = entry
    for lab, extra in EXTRAS.items():
        if lab not in labels:
            labels[lab] = extra
    ordered = {k: labels[k] for k in sorted(labels, key=lambda x: int(x, 8))}
    doc = {
        "source": "docs/labels_and_default_data.csv",
        "notes": "Aeroflex T1200 default-data dictionary. Encoding overlaid from known specs or inferred from NAME.",
        "labels": ordered,
    }
    OUT_PATH.write_text(
        "# Label library (Aeroflex T1200). Generated by scripts/build_label_library.py\n"
        + yaml.safe_dump(doc, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    print(f"wrote {len(ordered)} labels → {OUT_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
