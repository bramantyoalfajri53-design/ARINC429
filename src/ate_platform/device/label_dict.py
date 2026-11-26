"""Octal-label library for RX engineering decode (Aeroflex T1200 CSV)."""

from __future__ import annotations

from typing import Any, Optional

import yaml

from ate_platform.device.arinc_encode import (
    DATA_MASK19,
    DecodedWord,
    decode_word,
    format_pads,
    label_octal_str,
    parse_label,
    ssm_name_from_bits,
)
from ate_platform.device.arinc_profile import (
    LabelSpec,
    PROFILES_DIR,
    _label_from_raw,
    decode_label,
    invalidate_labels_yaml,
    label_spec_to_dict,
)

LABELS_PATH = PROFILES_DIR / "labels.yaml"

_cache: dict[str, LabelSpec] | None = None
_cache_key: tuple[Any, ...] | None = None


def _mtime_key() -> tuple[Any, ...]:
    if LABELS_PATH.is_file():
        return (LABELS_PATH.stat().st_mtime,)
    return ()


def invalidate_label_cache() -> None:
    global _cache, _cache_key
    _cache = None
    _cache_key = None
    invalidate_labels_yaml()


def label_dictionary() -> dict[str, LabelSpec]:
    """Library only — one octal, one format. LRU YAML does not overlay RX decode."""
    global _cache, _cache_key
    key = _mtime_key()
    if _cache is not None and _cache_key == key:
        return _cache
    out: dict[str, LabelSpec] = {}
    if LABELS_PATH.is_file():
        raw = yaml.safe_load(LABELS_PATH.read_text(encoding="utf-8")) or {}
        block = raw.get("labels") or {}
        for octal, spec_raw in block.items():
            if not isinstance(spec_raw, dict):
                continue
            payload = dict(spec_raw)
            payload["label"] = str(octal).zfill(3)
            payload["source"] = "library"
            out[str(octal).zfill(3)] = _label_from_raw(payload, str(spec_raw.get("funct") or ""))
    _cache = out
    _cache_key = key
    return out


def _format_name(encoding: str, octal: str, units: str) -> str:
    enc = (encoding or "raw").lower()
    if enc in {"bcd", "bcd_freq_khz", "bcd_tenths_khz", "dme_freq", "hf_pair"}:
        return "BCD"
    if enc == "bnr":
        return "BNR"
    if enc == "iso5":
        return "ISO #5"
    if octal in {"074", "126", "170", "270", "271", "272", "273", "277", "301", "302", "303"}:
        return "DISC"
    return "HEX"


_SSM_EXPLANATIONS: dict[str, str] = {
    "BCD": "BCD: 00=Plus/NML, 01=NCD, 10=Functional Test (FT), 11=Minus/SM",
    "BNR": "BNR: 00=Failure Warning (FAIL), 01=No Computed Data (NCD), 10=Functional Test (FT), 11=Normal (NML)",
    "ISO #5": "ISO #5: 00=Normal/Text (NML), 01=NCD, 10=FT, 11=Undefined/Ack (UND/INT)",
    "DISC": "Discrete: 00=Valid/Normal (NML), 01=NCD, 10=Functional Test (FT), 11=Normal/Verified (NML)",
    "HEX": "Raw/Hex: 00=FAIL/NML, 01=NCD, 10=FT, 11=Normal (NML)",
}

# Authentic Aeroflex JcAIR T1200B per-label specifications & LRU groupings
_T1200_LABEL_META: dict[str, dict[str, str]] = {
    "014": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "710 ILS, 704 IRS", "range_text": "0.0 - 359.9 DEG", "notes": "Magnetic / Runway Heading BCD (PAD 4-bit); T1200B 12.5 kbps"},
    "017": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "710 ILS, 755 MMR", "range_text": "0.0 - 359.9 DEG", "notes": "Selected Runway Heading BCD (PAD 4-bit); MMR Channel A"},
    "024": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "711 VOR", "range_text": "0.0 - 359.0 DEG", "notes": "Selected Course #1 BCD (PAD 8-bit); T1200B VOR Nav"},
    "027": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "711 VOR", "range_text": "0.0 - 359.0 DEG", "notes": "Selected Course #2 BCD (PAD 8-bit); T1200B VOR Nav"},
    "030": {"lru_group": "Comm (VHF/HF/VDR)", "lru_systems": "716 VHF COMM", "range_text": "118.000 - 136.975 MHz", "resolution": "25 kHz (5 BCD digits)", "notes": "Standard 25 kHz VHF Comm tuning (no PAD); 12.5 kbps"},
    "031": {"lru_group": "ATC/MMR", "lru_systems": "718 ATC / ATC/S", "range_text": "0000 - 7777 (Octal)", "resolution": "4 octal squawk digits", "notes": "Beacon/ATC Reply Code; PAD 7-bit + bit 11 Discrete"},
    "032": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "712 ADF", "range_text": "190.0 - 1750.0 kHz", "resolution": "0.5 kHz step", "notes": "ADF Frequency BCD; PAD 3-bit (bits 11-13); 12.5 kbps"},
    "033": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "710 ILS, 755 MMR", "range_text": "108.00 - 117.95 MHz", "resolution": "50 kHz step", "notes": "ILS Localizer/Glideslope Frequency BCD; PAD 4-bit"},
    "034": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "711 VOR, 579 VOR", "range_text": "108.00 - 117.95 MHz", "resolution": "50 kHz step", "notes": "VOR Frequency BCD; PAD 4-bit; 12.5 kbps"},
    "035": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "709 DME", "range_text": "108.00 - 117.95 MHz (1X-126Y)", "resolution": "50 kHz + Mode/NAV/DISP/IDENT", "notes": "DME Frequency BCD; bits 11-13 Mode, 14-15 NAV, 16 DISP, 17 IDENT"},
    "037": {"lru_group": "Comm (VHF/HF/VDR)", "lru_systems": "719 HF, 753 HFDU/HFDR", "range_text": "2.0000 - 29.9999 MHz", "resolution": "100 Hz (Dual-Word)", "notes": "Dual-Word HF Frequency; bit 9 Word#1/#2, bit 10 MOD/CW, bit 11 SB; 75 ms spacing"},
    "040": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR, DADS/FMS", "range_text": "-1000 - 50000 FT", "notes": "Set Altitude (MMR Channel B & C background simulation)"},
    "042": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR, MLS/IRS", "range_text": "-180.0 - +180.0 DEG", "notes": "Set Longitude / MLS Azimuth Angle (MMR Channels B/C)"},
    "043": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR, MLS/IRS", "range_text": "0.0 - 359.9 DEG", "notes": "Magnetic Heading BCD / MLS Elevation Angle"},
    "047": {"lru_group": "Comm (VHF/HF/VDR)", "lru_systems": "716 VHF 8.33", "range_text": "118.000 - 136.992 MHz", "resolution": "8.33 kHz channel spacing", "notes": "VHF 8.33 kHz Comm Frequency BCD; 12.5 kbps"},
    "074": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR / GNSS", "range_text": "0x00000 - 0x7FFFF", "notes": "GNSS / MMR Data Status Discrete Word"},
    "076": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR / GNSS", "range_text": "-1000 - +131071 FT", "notes": "GPS Altitude BNR (18-bit)"},
    "100": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "711 VOR", "range_text": "-180.0 - +180.0 DEG", "notes": "Selected Course #1 BNR (12-bit, PAD 6-bit)"},
    "101": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR / FMS", "range_text": "-180.0 - +180.0 DEG", "notes": "Selected Heading BNR"},
    "102": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR / DADS", "range_text": "-1000 - +65536 FT", "notes": "Selected Altitude BNR"},
    "103": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR / DADS", "range_text": "0 - 512 KTS", "notes": "Selected Airspeed BNR"},
    "105": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "710 ILS", "range_text": "-180.0 - +180.0 DEG", "notes": "Selected Runway Heading BNR (PAD 7-bit)"},
    "110": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "711 VOR", "range_text": "-180.0 - +180.0 DEG", "notes": "Selected Course #2 BNR (12-bit, PAD 6-bit)"},
    "111": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR / GNSS", "range_text": "-90.0 - +90.0 DEG", "notes": "GPS Latitude Fine BNR"},
    "112": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR / GNSS", "range_text": "-180.0 - +180.0 DEG", "notes": "GPS Longitude Fine BNR"},
    "125": {"lru_group": "CFDS / CMC", "lru_systems": "CFDS, Boeing CMC, 755 MMR", "range_text": "00:00.0 - 23:59.9 UTC", "notes": "UTC Time (CMC Transmit Word / MMR INC TIME)"},
    "126": {"lru_group": "CFDS / CMC", "lru_systems": "CFDS, Boeing CMC", "range_text": "Phase 1 - 15", "notes": "Aircraft Flight Phase / BITE Status Word (ARINC 604)"},
    "130": {"lru_group": "VHF Align", "lru_systems": "Collins VHF-900 Align", "range_text": "0x0000 - 0xFFFF", "notes": "VHF-900 RAM/ROM Address & Control Word; 100 kbps Channel C"},
    "131": {"lru_group": "VHF Align", "lru_systems": "Collins VHF-900 Align", "range_text": "0x0000 - 0xFFFF", "notes": "VHF-900 RAM/ROM Data & Block Write Word; 100 kbps Channel C"},
    "140": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR / GNSS", "range_text": "0000 - 2359 HHMM", "notes": "UTC Fine / MMR Time BCD"},
    "150": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR / UTC", "range_text": "00:00:00 - 23:59:59 UTC", "notes": "UTC Fine Time (MMR INC TIME auto-increment)"},
    "162": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "712 ADF", "range_text": "-180.0 - +180.0 DEG", "notes": "ADF Bearing BNR (12-bit, 50 ms, Time Constant filter supported)"},
    "164": {"lru_group": "LRA", "lru_systems": "707 LRA", "range_text": "0.0 - +2500.0 FT", "notes": "Radio Altimeter Height BNR (16-bit, 37 ms)"},
    "165": {"lru_group": "LRA", "lru_systems": "707 LRA", "range_text": "0.0 - 2500.0 FT", "notes": "Radio Altimeter Height BCD (100 ms)"},
    "166": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR / GLS", "range_text": "-0.8 - +0.8 DDM", "notes": "GLS / MMR Vertical Deviation BNR"},
    "170": {"lru_group": "CFDS / CMC", "lru_systems": "CFDS, Boeing CMC", "range_text": "17-bit Discrete Mask", "notes": "Aircraft Configuration Word (17 toggles bits 11-27, ARINC 604)"},
    "172": {"lru_group": "Comm (VHF/HF/VDR)", "lru_systems": "750 VDR, VDL MODE", "range_text": "0x000000 - 0x07FFFF", "notes": "VDR System Address Label (SAL) 24-bit Binary/Hex; 100 kbps Channel C"},
    "173": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "710 ILS, 755 MMR", "range_text": "-0.4000 - +0.4000 DDM", "notes": "Localizer Deviation BNR (12-bit, Time Constant filter supported)"},
    "174": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "710 ILS, 755 MMR", "range_text": "-0.8000 - +0.8000 DDM", "notes": "Glideslope Deviation BNR (12-bit, Time Constant filter supported)"},
    "201": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "709 DME", "range_text": "0.00 - 399.99 NM", "notes": "DME Distance BCD Output (125 ms)"},
    "202": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "709 DME", "range_text": "0.00 - 399.99 NM", "notes": "DME Distance BNR Output (bit 11 MEM, bit 12 B/F, 125 ms)"},
    "203": {"lru_group": "ATC/MMR", "lru_systems": "718 ATC / ATC/S, 755 MMR", "range_text": "-1000 - 131071 FT", "notes": "Pressure Altitude BNR (17-bit, 50 ms)"},
    "205": {"lru_group": "Comm (VHF/HF/VDR)", "lru_systems": "Air Data Mach, 719/753 HF RMP", "range_text": "0.000 - 2.000 M / 2-29.9999 MHz", "notes": "T1200B Table: MACH BNR; also dual-word HF-A COMM on 719/753 RMP screens"},
    "206": {"lru_group": "Comm (VHF/HF/VDR)", "lru_systems": "Air Data CAS, 719 HF ACARS", "range_text": "0 - 1024 KT / 2-29.9999 MHz", "notes": "T1200B Table: Computed Airspeed BNR; also dual-word HF-A COMM on 719 ACARS"},
    "207": {"lru_group": "Comm (VHF/HF/VDR)", "lru_systems": "Air Data Max Spd, 719/753 HF MODE", "range_text": "0 - 1024 KT / HEX MODE", "notes": "T1200B Table: Max Airspeed BNR; also 207 HF MODE Discrete on HF RMP/ACARS"},
    "222": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "711 VOR, 579 VOR", "range_text": "-180.0 - +180.0 DEG", "notes": "VOR Omnibearing BNR (12-bit, Time Constant filter supported)"},
    "227": {"lru_group": "CFDS / CMC", "lru_systems": "CFDS, Boeing CMC", "range_text": "Eq ID 000-FFF + Fn 0-5", "notes": "Maintenance Command Word (ARINC 604 / ABD0018 / ABD0048)"},
    "233": {"lru_group": "CFDS / CMC", "lru_systems": "Air Data SAT, Boeing CMC (FLT_NUM)", "range_text": "DEGC / ISO #5", "notes": "T1200B Table: SAT BCD; CMC Transmit Word Flight Number #1"},
    "234": {"lru_group": "CFDS / CMC", "lru_systems": "Baro Corr 1 mb, Boeing CMC (FLT_NUM 2)", "range_text": "745 - 1050 mb / ISO #5", "notes": "T1200B Table: BARO COR1 mb; CMC Flight Number #2"},
    "235": {"lru_group": "CFDS / CMC", "lru_systems": "Baro Corr 1 inHg, Boeing CMC (CITY_PAIRS)", "range_text": "22.00 - 32.00 inHg / ISO #5", "notes": "T1200B Table: BARO COR1 inHg; CMC City Pairs (DNVR MKCI)"},
    "236": {"lru_group": "CFDS / CMC", "lru_systems": "Baro Corr 2 mb, Boeing CMC (AIRCRAFT_ID)", "range_text": "745 - 1050 mb / ISO #5", "notes": "T1200B Table: BARO COR2 mb; CMC Aircraft Tail ID"},
    "246": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "709 DME", "range_text": "3 ISO #5 Chars", "notes": "DME Ground Station Ident #1 (ISO #5, SDI=11)"},
    "247": {"lru_group": "Nav (DME/VOR/ILS/ADF)", "lru_systems": "709 DME, 711 VOR", "range_text": "3 ISO #5 Chars", "notes": "DME/VOR Ground Station Ident #2 (ISO #5, SDI=11)"},
    "260": {"lru_group": "CFDS / CMC", "lru_systems": "CFDS, Boeing CMC, 755 MMR", "range_text": "DD/MM/YY (BCD)", "notes": "Calendar Date BCD (CMC Transmit Word & MMR)"},
    "270": {"lru_group": "Comm (VHF/HF/VDR)", "lru_systems": "750 VDR, General Discrete", "range_text": "19-bit Discrete (0x00000-0x7FFFF)", "notes": "Discrete Data 1 (VDR Control / ARINC 429 Discrete)"},
    "271": {"lru_group": "Comm (VHF/HF/VDR)", "lru_systems": "General Discrete", "range_text": "19-bit Discrete", "notes": "Discrete Data 2 (Status / Control Bits)"},
    "272": {"lru_group": "Comm (VHF/HF/VDR)", "lru_systems": "General Discrete", "range_text": "19-bit Discrete", "notes": "Discrete Data 3 (Status / Control Bits)"},
    "273": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR", "range_text": "19-bit Discrete", "notes": "MMR Mode / GLS Discrete Word"},
    "277": {"lru_group": "CFDS / CMC", "lru_systems": "Self-Test / General", "range_text": "Test Word 19-bit", "notes": "ARINC 429 Maintenance / Test Word"},
    "301": {"lru_group": "CFDS / CMC", "lru_systems": "CFDS ABD0018/0048", "range_text": "19-bit Discrete", "notes": "CFDS Aircraft Configuration Word 1"},
    "302": {"lru_group": "CFDS / CMC", "lru_systems": "CFDS ABD0018/0048", "range_text": "19-bit Discrete", "notes": "CFDS Aircraft Configuration Word 2"},
    "303": {"lru_group": "CFDS / CMC", "lru_systems": "CFDS ABD0018/0048", "range_text": "19-bit Discrete", "notes": "CFDS Aircraft Configuration Word 3"},
    "320": {"lru_group": "ATC/MMR", "lru_systems": "755 MMR, IRS", "range_text": "-180.0 - +180.0 DEG", "notes": "Magnetic Heading BNR (IRS / MMR Channel B & C)"},
    "350": {"lru_group": "CFDS / CMC", "lru_systems": "Boeing CMC, CFDS", "range_text": "19-bit Fault Summary (Bits 11-29)", "notes": "Maintenance / Fault Summary Word (Bit 28 Data Xfer, Bit 29 Cmd ACK)"},
    "355": {"lru_group": "CFDS / CMC", "lru_systems": "CFDS ABD0048", "range_text": "19-bit Discrete Fault", "notes": "CFDS Discrete Fault Word (Failure No, Type Code, Suspect LRU)"},
    "356": {"lru_group": "CFDS / CMC", "lru_systems": "CFDS ABD0018/0048", "range_text": "3 ISO #5 Chars / Word", "notes": "CFDS Maintenance / MCDU 14x24 Menu Message (ISO #5)"},
    "357": {"lru_group": "CFDS / CMC", "lru_systems": "710 ILS, CFDS ABD0048", "range_text": "3 ISO #5 Chars", "notes": "ISO #5 Alpha / CFDS Interactive Request Word"},
    "377": {"lru_group": "CFDS / CMC", "lru_systems": "CFDS, Boeing CMC", "range_text": "000 - FFF (Hex)", "notes": "ARINC 429 Equipment Identification Word (Eq Code)"},
}


def _enrich_t1200_metadata(item: dict[str, Any]) -> dict[str, Any]:
    octal = str(item.get("label") or "").zfill(3)
    enc = str(item.get("encoding") or "raw")
    units = str(item.get("units") or "")
    fmt = _format_name(enc, octal, units)
    meta = _T1200_LABEL_META.get(octal, {})

    lru_group = meta.get("lru_group")
    if not lru_group:
        if octal in {"242", "243", "254", "255", "263", "264"}:
            lru_group = "Nav (DME/VOR/ILS/ADF)"
        elif octal in {"310", "311", "312", "313", "314", "317", "321", "322", "324", "325"}:
            lru_group = "ATC/MMR"
        elif octal in {"351"}:
            lru_group = "CFDS / CMC"
        else:
            lru_group = "Air Data / IRS / General"

    pads = str(item.get("pads") or "-")
    pad_len = len(pads) if set(pads) <= {"0", "1"} and pads not in {"", "-"} else 0
    if fmt == "BCD":
        sig_bits = f"{item.get('bcd_digits', 5)} digits (PAD {pad_len}b)"
        res_txt = meta.get("resolution") or f"1 / {item.get('bcd_scale', 1.0):g}"
        rng_txt = meta.get("range_text") or "BCD Engineering Range"
    elif fmt == "BNR":
        bits_n = int(item.get("bnr_bits") or max(1, 19 - pad_len))
        sig_bits = f"{bits_n}-bit BNR (PAD {pad_len}b)"
        res_txt = meta.get("resolution") or f"LSB = {item.get('bnr_lsb', 1.0):g} {units}".strip()
        rng_txt = meta.get("range_text") or f"±{((1 << (bits_n - 1)) * float(item.get('bnr_lsb') or 1.0)):g} {units}".strip()
    elif fmt == "ISO #5":
        sig_bits = f"{item.get('iso5_chars', 3)} x 7-bit ASCII (19 data bits)"
        res_txt = "7-bit ISO Alphabet #5"
        rng_txt = meta.get("range_text") or "ASCII Characters"
    else:
        sig_bits = f"19 data bits (PAD {pad_len}b)"
        res_txt = meta.get("resolution") or "Bitwise / Hex"
        rng_txt = meta.get("range_text") or "0x00000 - 0x7FFFF"

    item["format"] = fmt
    item["lru_group"] = lru_group
    item["lru_systems"] = meta.get("lru_systems") or lru_group
    item["default_value"] = "" if item.get("eng_default") is None else str(item.get("eng_default"))
    item["range_text"] = rng_txt
    item["resolution"] = res_txt
    item["sig_bits"] = sig_bits
    item["ssm_type"] = _SSM_EXPLANATIONS.get(fmt, _SSM_EXPLANATIONS["HEX"])
    doc_ref = str(item.get("doc_page") or "")
    base_note = meta.get("notes") or f"Aeroflex JcAIR T1200B Standard Label ({fmt})"
    item["notes"] = f"{base_note} [Ref: {doc_ref}]" if doc_ref and doc_ref not in base_note else base_note
    item["bit_layout"] = {
        "bits_1_8": f"Label {octal} (Octal)",
        "bits_9_10": f"SDI ({str(item.get('sdi', 0)).zfill(2)})",
        "bits_11_29": f"{sig_bits} · Res: {res_txt}",
        "bits_30_31": item["ssm_type"],
        "bit_32": f"{item.get('parity', 'ODD')} Parity",
    }
    return item


def library_catalog() -> list[dict[str, Any]]:
    """Rows for the Label Library screen (CSV + T1200B extended labels ordered by octal)."""
    raw_block: dict[str, Any] = {}
    if LABELS_PATH.is_file():
        raw = yaml.safe_load(LABELS_PATH.read_text(encoding="utf-8")) or {}
        raw_block = raw.get("labels") or {}
    rows: list[dict[str, Any]] = []
    for octal, spec in sorted(label_dictionary().items(), key=lambda kv: int(kv[0], 8)):
        item = label_spec_to_dict(spec)
        extra = raw_block.get(octal) or {}
        item["pads"] = extra.get("pads", spec.pads)
        item["doc_page"] = extra.get("doc_page", "")
        item["name"] = spec.funct
        rows.append(_enrich_t1200_metadata(item))
    return rows


def lookup_label(octal: int | str) -> Optional[LabelSpec]:
    try:
        key = label_octal_str(parse_label(octal))
    except ValueError:
        return None
    return label_dictionary().get(key)


def format_display(data19: int, eng_text: str, display_mode: str) -> str:
    dm = (display_mode or "HEX").upper()
    if dm == "BIN":
        return format(int(data19) & DATA_MASK19, "019b")
    if dm == "ENG" and eng_text:
        return eng_text
    return f"0x{int(data19) & DATA_MASK19:05X}"


def decode_received(word: int, *, display_mode: str = "ENG") -> dict[str, Any]:
    """Decode one RX word using the label library. Safe for tests."""
    decoded: DecodedWord = decode_word(int(word), profile="none")
    spec = lookup_label(decoded.label_octal)
    funct = decoded.funct
    eng_text = decoded.data_text
    eng_value: Any = None
    units = ""
    ssm_name = decoded.ssm_name
    pads = "-"
    mem = ""
    bf = ""
    extra = {}
    if spec is not None:
        try:
            eng = decode_label(spec, int(word))
            funct = spec.funct or funct
            eng_text = eng.get("data_text") or eng_text
            eng_value = eng.get("eng_value")
            units = spec.units
            extra = eng.get("extra") or {}
            mem = extra.get("mem", "")
            bf = extra.get("bf", "")
        except Exception:
            pass
        ssm_name = ssm_name_from_bits(decoded.ssm, spec.encoding, spec.ssm)
        pads = format_pads(decoded.data19, spec.pads)

    if decoded.label_octal == "202":
        if not mem:
            mem = "ON" if ((int(word) >> 10) & 1) else "OFF"
        if not bf:
            bf = "F" if ((int(word) >> 11) & 1) else "B"
        if isinstance(extra, dict):
            extra.setdefault("mem", mem)
            extra.setdefault("bf", bf)

    data_disp = format_display(decoded.data19, eng_text, display_mode)
    return {
        "label_octal": decoded.label_octal,
        "label": decoded.label,
        "sdi": decoded.sdi,
        "ssm": decoded.ssm,
        "ssm_name": ssm_name,
        "parity_odd": decoded.parity_odd,
        "raw": decoded.raw,
        "data19": decoded.data19,
        "pad3": decoded.pad3,
        "pads": pads,
        "data16": decoded.data16,
        "funct": funct,
        "data_text": eng_text,
        "data_display": data_disp,
        "eng_value": eng_value,
        "units": units,
        "encoding": spec.encoding if spec else "raw",
        "mem": mem,
        "bf": bf,
        "extra": extra,
    }
