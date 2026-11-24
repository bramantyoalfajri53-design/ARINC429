"""ARINC 429 LRU profile loader + engineering-value encode/decode."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from ate_platform.paths import REPO_ROOT
from ate_platform.device.arinc_encode import (
    DATA_MASK19,
    SSM_NAMES,
    decode_dme_distance_201,
    decode_dme_distance_202,
    get_data19,
    label_octal_str,
    parse_label,
    put_data19,
    put_ssm_bits,
    resolve_ssm,
    split_pad,
)

try:
    from btidriver import bti429
except ImportError:  # pragma: no cover
    from ate_platform.device.arinc_encode import bti429

PROFILES_DIR = REPO_ROOT / "profiles" / "arinc"
_ID_RE = re.compile(r"^[a-z][a-z0-9_]{0,47}$")
ENCODINGS = (
    "raw", "bcd", "bcd_freq_khz", "bcd_tenths_khz", "bnr", "iso5", "dme_freq", "hf_pair",
)
DME_MODES = ("STBY", "DF1", "DF2", "DF3", "DF4", "DF5", "SCAN")
DME_MODE_BITS = {"STBY": 0, "DF1": 1, "DF2": 2, "DF3": 3, "DF4": 4, "DF5": 5, "SCAN": 6}
DME_NAV_BITS = {"VOR": 0, "ILS": 1, "MLS": 2, "UND": 3}
FILTER_LABELS = {"222": "VOR", "162": "ADF", "173": "ILS", "174": "ILS"}
TIME_CONSTANTS = (0.0, 0.4, 0.8, 1.6, 3.2, 6.4, 12.8)
LOW_RATES = (8.1, 9.4, 11.1, 12.5, 13.9, 15.1, 17.2, 18.5, 20.0)
HIGH_RATES = (83.0, 100.0, 125.0)

# Section 4.E: Collins VHF-2100 13 ADC Voltage Report Channels (Label 353)
VHF2100_ADC_CHANNELS: dict[int, tuple[str, str, Any]] = {
    0: ("MIC AUDIO SAMPLE 1", "VDC", lambda d: ((d * 625) / 1024) / 1000.0),
    1: ("Q DETECT LEVEL", "VDC", lambda d: ((d * 625) / 1024) / 1000.0),
    2: ("FORWARD VOLTAGE LEVEL", "VDC", lambda d: ((d * 625) / 1024) / 1000.0),
    3: ("REVERSE VOLTAGE LEVEL", "VDC", lambda d: ((d * 625) / 1024) / 1000.0),
    4: ("MIC AUDIO SAMPLE 2", "VDC", lambda d: ((d * 625) / 1024) / 1000.0),
    5: ("HW AGC LEVEL", "VDC", lambda d: ((d * 625) / 1024) / 1000.0),
    8: ("POWER SUPPLY +3.3 VDC", "VDC", lambda d: ((d * 3275) / 2048) / 1000.0),
    9: ("POWER SUPPLY +8.0 VDC", "VDC", lambda d: ((d * 15275) / 4096) / 1000.0),
    10: ("POWER SUPPLY -8.0 VDC", "VDC", lambda d: (((d * 35125) / 8448) / 1000.0) * -1.0),
    11: ("POWER SUPPLY +5.0 VDC", "VDC", lambda d: ((d * 8025) / 4096) / 1000.0),
    12: ("POWER SUPPLY +15 VDC", "VDC", lambda d: ((d * 28625) / 4096) / 1000.0),
    13: ("POWER SUPPLY +28.0 VDC", "VDC", lambda d: ((d * 53450) / 4096) / 1000.0),
    14: ("PA TEMPERATURE LEVEL", "DEGC", lambda d: ((d * 625) / 1024) / 10.0),
}


def decode_vhf2100_adc_353(word: int) -> dict[str, Any]:
    """Decode internal ADC voltage report encoded on Label 353 per T1200B Manual Section 4.E."""
    w = int(word) & 0xFFFFFFFF
    subfield = (w >> 24) & 0x1F
    raw_data = (w >> 10) & 0xFFF
    if subfield in VHF2100_ADC_CHANNELS:
        name, units, fn = VHF2100_ADC_CHANNELS[subfield]
        val = round(float(fn(raw_data)), 3)
        return {
            "subfield": subfield,
            "channel_num": subfield,
            "name": name,
            "param": name,
            "units": units,
            "value": val,
            "raw_data": raw_data,
            "text": f"{val:.3f} {units}",
        }
    return {
        "subfield": subfield,
        "name": f"UNKNOWN_SUBFIELD_{subfield}",
        "units": "VDC",
        "value": None,
        "raw_data": raw_data,
        "text": f"SUBFIELD_{subfield}: 0x{raw_data:03X}",
    }

# Figure 14 T1200 characteristic grid (Standard Mode).
CATALOG = (
    {"id": "adf_032", "char": "712", "title": "ADF", "kind": "lru"},
    {"id": "vor", "char": "711", "title": "VOR", "kind": "lru"},
    {"id": "ils", "char": "710", "title": "ILS", "kind": "lru"},
    {"id": "dme", "char": "709", "title": "DME", "kind": "dme"},
    {"id": "atc_xpdr", "char": "718", "title": "ATC", "kind": "lru"},
    {"id": "radio_alt", "char": "707", "title": "LRA", "kind": "lru"},
    {"id": "vhf_comm", "char": "716", "title": "VHF", "kind": "lru"},
    {"id": "hf_719", "char": "719", "title": "HF", "kind": "hf"},
    {"id": "hfdu_753", "char": "753", "title": "HFDU", "kind": "hf"},
    {"id": "vdr_750", "char": "750", "title": "VDR", "kind": "lru"},
    {"id": "hfdr_753", "char": "753", "title": "HFDR", "kind": "hf"},
    {"id": "hf_rmp", "char": "719", "title": "HF RMP", "kind": "hf"},
    {"id": "hf_acars", "char": "719", "title": "HF ACARS", "kind": "hf"},
    {"id": "hfdu_rmp", "char": "753", "title": "HFDU RMP", "kind": "hf"},
    {"id": "hfdr_rmp", "char": "753", "title": "HFDR RMP", "kind": "hf"},
    {"id": "vhf_833", "char": "716", "title": "8.33", "kind": "lru"},
    {"id": "mmr_755", "char": "755", "title": "MMR", "kind": "mmr"},
    {"id": "vhf_align", "char": "VHF", "title": "ALIGN", "kind": "lru"},
    {"id": "vdl_mode", "char": "VDL", "title": "MODE", "kind": "lru"},
    {"id": "vor_579", "char": "579", "title": "VOR", "kind": "lru"},
)
CATALOG_IDS = {c["id"] for c in CATALOG}
CATALOG_KIND = {c["id"]: c["kind"] for c in CATALOG}


@dataclass
class LabelSpec:
    label_octal: str
    funct: str = ""
    direction: str = "tx"
    sdi: int = 0
    ssm: str = "NML"
    parity: str = "ODD"
    rate_ms: int = 150
    encoding: str = "raw"
    units: str = ""
    eng_name: str | None = None
    eng_min: float = 0.0
    eng_max: float = 0.0
    eng_step: float = 1.0
    eng_default: float | str | None = None
    bnr_lsb: float = 1.0
    bnr_offset: float = 0.0
    bnr_bits: int = 16
    bcd_scale: float = 1.0
    bcd_digits: int = 5
    word_index: int = 1
    iso5_chars: int = 3
    bus: str = ""
    source: str = "custom"
    pads: str = "-"


@dataclass
class Profile:
    id: str
    name: str
    funct: str = ""
    mode: str = "standard"
    bus: str = "A"
    tx_ch: str = "A"
    rx_ch: str = "A"
    high_speed: bool = False
    characteristic: str = ""
    notes: str = ""
    labels: list[LabelSpec] = field(default_factory=list)

    def find_label(self, label_octal: str, word_index: int | None = None) -> LabelSpec | None:
        wanted = str(label_octal).zfill(3)
        matches = [ls for ls in self.labels if ls.label_octal == wanted]
        if word_index is not None:
            for ls in matches:
                if int(ls.word_index) == int(word_index):
                    return ls
        return matches[0] if matches else None


def _parity_name(raw: Any) -> str:
    s = str(raw or "ODD").strip().upper()
    if s in {"EVEN", "E", "0"}:
        return "EVEN"
    return "ODD"


def channel_letter(raw: Any, fallback: str = "A") -> str:
    s = str(raw or fallback).strip().upper()[:1]
    return s if s in ("A", "B", "C", "D") else fallback


def _need_bti() -> None:
    if bti429 is None:
        raise ImportError("btidriver required for ARINC encode/decode")


_LABELS_YAML: dict[str, dict[str, Any]] | None = None


def invalidate_labels_yaml() -> None:
    global _LABELS_YAML
    _LABELS_YAML = None


def _labels_yaml() -> dict[str, dict[str, Any]]:
    """Canonical octal → encoding/units from labels.yaml (fill missing profile fields)."""
    global _LABELS_YAML
    if _LABELS_YAML is None:
        path = PROFILES_DIR / "labels.yaml"
        out: dict[str, dict[str, Any]] = {}
        if path.is_file():
            raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            for k, v in (raw.get("labels") or {}).items():
                if isinstance(v, dict):
                    out[str(k).zfill(3)] = v
        _LABELS_YAML = out
    return _LABELS_YAML


def _label_source(raw: dict[str, Any]) -> str:
    s = str(raw.get("source") or "").strip().lower()
    if s in ("library", "custom"):
        return s
    return "custom" if raw.get("encoding") else "library"


def _label_from_raw(raw: dict[str, Any], profile_funct: str) -> LabelSpec:
    octal = str(raw.get("label_octal") or raw.get("label") or "000").zfill(3)
    source = _label_source(raw)
    base = _labels_yaml().get(octal) or {} if source == "library" else {}
    eng = raw.get("eng") if isinstance(raw.get("eng"), dict) else {}
    base_eng = base.get("eng") if isinstance(base.get("eng"), dict) else {}
    bnr = raw.get("bnr") if isinstance(raw.get("bnr"), dict) else (base.get("bnr") or {})
    enc = str(raw.get("encoding") or raw.get("encode") or base.get("encoding") or "raw")
    units = str(raw.get("units") or eng.get("units") or base.get("units") or base_eng.get("units") or "")
    default = eng.get("default", raw.get("eng_default", raw.get("default_data_khz", base_eng.get("default"))))
    ls = LabelSpec(
        label_octal=octal,
        funct=str(raw.get("funct") or base.get("funct") or profile_funct or ""),
        direction=str(raw.get("direction") or "tx"),
        sdi=int(raw.get("sdi", raw.get("default_sdi", base.get("sdi", 0)))),
        ssm=str(raw.get("ssm", raw.get("default_ssm", base.get("ssm", "NML")))),
        parity=_parity_name(raw.get("parity", raw.get("par", base.get("parity", "ODD")))),
        rate_ms=int(raw.get("rate_ms", base.get("rate_ms", 150))),
        encoding=enc,
        units=units,
        eng_name=eng.get("name") or base_eng.get("name"),
        eng_min=float(eng.get("min", base_eng.get("min", 0.0))),
        eng_max=float(eng.get("max", base_eng.get("max", 0.0))),
        eng_step=float(eng.get("step", base_eng.get("step", 1.0))),
        eng_default=default,
        bnr_lsb=float(bnr.get("lsb", 1.0)),
        bnr_offset=float(bnr.get("offset", 0.0)),
        bnr_bits=int(bnr.get("bits", 16)),
        bcd_scale=float(raw.get("bcd_scale", eng.get("bcd_scale", base.get("bcd_scale", 1.0)))),
        bcd_digits=int(raw.get("bcd_digits", eng.get("bcd_digits", base.get("bcd_digits", 5)))),
        word_index=int(raw.get("word_index", 1)),
        iso5_chars=int(raw.get("iso5_chars", base.get("iso5_chars", 3))),
        bus=str(raw.get("bus") or "").upper(),
        source=source,
        pads=str(raw.get("pads") or base.get("pads") or "-"),
    )
    derived = bits_from_pads(ls.pads)
    if ls.encoding.lower() == "bnr" and derived is not None:
        ls.bnr_bits = derived
    return ls


def label_spec_to_dict(ls: LabelSpec) -> dict[str, Any]:
    """Stable JSON/YAML view of one label template (encoding, units, defaults)."""
    return {
        "label": ls.label_octal,
        "funct": ls.funct,
        "direction": ls.direction,
        "bus": ls.bus,
        "sdi": ls.sdi,
        "ssm": ls.ssm,
        "par": ls.parity,
        "parity": ls.parity,
        "rate_ms": ls.rate_ms,
        "encoding": ls.encoding,
        "units": ls.units,
        "eng_name": ls.eng_name,
        "eng_min": ls.eng_min,
        "eng_max": ls.eng_max,
        "eng_step": ls.eng_step,
        "eng_default": ls.eng_default,
        "bcd_scale": ls.bcd_scale,
        "bcd_digits": ls.bcd_digits,
        "bnr_lsb": ls.bnr_lsb,
        "bnr_offset": ls.bnr_offset,
        "bnr_bits": ls.bnr_bits,
        "word_index": ls.word_index,
        "iso5_chars": ls.iso5_chars,
        "source": ls.source or "custom",
        "pads": ls.pads or "-",
    }


def load_profile(profile_id: str) -> Profile:
    alias_map = {
        "freq": "dme",
        "dme_freq": "dme",
        "single": "dme",
        "multi": "dme",
    }
    clean_id = str(profile_id or "").strip().lower()
    clean_id = alias_map.get(clean_id, clean_id)
    path = PROFILES_DIR / f"{clean_id}.yaml"
    if not path.is_file():
        raise FileNotFoundError(f"Unknown profile: {profile_id}")
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    labels_raw = raw.get("labels")
    funct = str(raw.get("funct") or raw.get("name") or profile_id)
    if labels_raw:
        labels = [_label_from_raw(l, funct) for l in labels_raw]
    else:
        labels = [_label_from_raw(raw, funct)]
    bus = channel_letter(raw.get("bus") or raw.get("tx_ch") or "A")
    tx_ch = channel_letter(raw.get("tx_ch") or bus)
    rx_ch = channel_letter(raw.get("rx_ch") or raw.get("bus") or tx_ch)
    return Profile(
        id=str(raw.get("id") or profile_id),
        name=str(raw.get("name") or profile_id),
        funct=funct,
        mode=str(raw.get("mode") or "standard"),
        bus=tx_ch,
        tx_ch=tx_ch,
        rx_ch=rx_ch,
        high_speed=bool(raw.get("high_speed", raw.get("bit_rate_kbps", 12.5) == 100.0)),
        characteristic=str(raw.get("arinc_characteristic") or raw.get("characteristic") or ""),
        notes=str(raw.get("notes") or ""),
        labels=labels,
    )


def list_profiles() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not PROFILES_DIR.is_dir():
        return out
    for path in sorted(PROFILES_DIR.glob("*.yaml")):
        if path.stem == "labels" or path.stem.startswith("_"):
            continue
        try:
            p = load_profile(path.stem)
            out.append({
                "id": p.id, "name": p.name, "funct": p.funct, "mode": p.mode,
                "bus": p.tx_ch, "tx_ch": p.tx_ch, "rx_ch": p.rx_ch,
                "characteristic": p.characteristic,
                "high_speed": p.high_speed,
                "catalog": p.id in CATALOG_IDS,
                "kind": CATALOG_KIND.get(p.id, "custom"),
                "labels": [ls.label_octal for ls in p.labels],
            })
        except Exception:
            continue
    return out


def iso5_pack(text: str, nchars: int = 3) -> int:
    """Pack ISO Alphabet No. 5 (6-bit, ASCII low bits) into data19 from bit 11."""
    s = (text or "").upper()[:nchars].ljust(nchars)
    data = 0
    for i, ch in enumerate(s):
        code = 0x20 if ch == " " else (ord(ch) & 0x3F)
        data |= (code & 0x3F) << (i * 6)
    return data & DATA_MASK19


def iso5_unpack(data19: int, nchars: int = 3) -> str:
    chars: list[str] = []
    d = int(data19) & DATA_MASK19
    for i in range(nchars):
        code = (d >> (i * 6)) & 0x3F
        if code == 0 or code == 0x20:
            chars.append(" ")
        elif 1 <= code <= 26:
            chars.append(chr(ord("A") + code - 1))
        elif 0x21 <= code <= 0x3A:
            chars.append(chr(code | 0x40) if code < 0x30 else chr(code))
        else:
            ch = chr(code | 0x40) if 0x01 <= code <= 0x3A else " "
            chars.append(ch)
    return "".join(chars).rstrip()


def dme_pack(
    freq_mhz: float,
    *,
    mode: str = "DF1",
    nav: str = "VOR",
    disp: bool = False,
    ident: bool = False,
    pad_bits: int | str | None = None,
) -> int:
    """ARINC 709 BCD frequency (108.00 - 135.95 MHz) with control bits in 11-17 (bits 0-6 of data19)."""
    mhz_int = int(freq_mhz)
    fract = int(round((freq_mhz - mhz_int) * 100))
    bit_50k = 1 if (fract % 10 == 5) else 0
    b_100k = (fract // 10) & 0xF
    b_1m = (mhz_int % 10) & 0xF
    b_10m = ((mhz_int // 10) % 10) & 0x7
    freq12 = (b_10m << 9) | (b_1m << 5) | (b_100k << 1) | bit_50k

    if pad_bits is not None:
        if isinstance(pad_bits, str):
            clean = pad_bits.strip().replace(" ", "")
            p_val = int(clean, 2) if (clean and all(c in "01" for c in clean)) else int(clean, 0)
        else:
            p_val = int(pad_bits)
    else:
        m_val = DME_MODE_BITS.get(str(mode).upper(), 1) & 0x7
        n_val = (DME_NAV_BITS.get(str(nav).upper(), 0) & 0x3) << 3
        d_val = (1 if disp else 0) << 5
        i_val = (1 if ident else 0) << 6
        p_val = m_val | n_val | d_val | i_val
    return ((freq12 << 7) | (p_val & 0x7F)) & DATA_MASK19


def dme_unpack(data19: int) -> dict[str, Any]:
    d = int(data19) & DATA_MASK19
    mode_i = d & 0x7
    nav_i = (d >> 3) & 0x3
    mode = next((k for k, v in DME_MODE_BITS.items() if v == mode_i), f"M{mode_i}")
    nav = next((k for k, v in DME_NAV_BITS.items() if v == nav_i), "UND")
    disp = bool((d >> 5) & 1)
    ident = bool((d >> 6) & 1)
    pad_bits = d & 0x7F
    pads = format(pad_bits, "07b")

    freq12 = (d >> 7) & 0xFFF
    bit_50k = freq12 & 1
    b_100k = (freq12 >> 1) & 0xF
    b_1m = (freq12 >> 5) & 0xF
    b_10m = (freq12 >> 9) & 0x7
    freq = round(100.0 + (b_10m * 10.0) + b_1m + (b_100k * 0.1) + (bit_50k * 0.05), 2)

    return {
        "freq_mhz": freq,
        "mode": mode,
        "nav": nav,
        "disp": disp,
        "ident": ident,
        "pad_bits": pad_bits,
        "pads": pads,
    }


def rate_to_high_speed(kbps: float) -> bool:
    return float(kbps) >= 50.0


def _put_parity(word: int, parity: str) -> int:
    """Set ARINC bit 32 so the 32-bit word has odd or even popcount."""
    word = bti429.FldPutParBit(word)
    if _parity_name(parity) == "EVEN":
        word ^= 1 << 31
    return word


def sched_period_ms(rate_ms: int) -> tuple[int, int]:
    """Ballard SchedBuild min/max. Keep them equal so the T1200 rate matches TX."""
    r = max(10, int(rate_ms))
    return r, r


def _hf_bcd_bits_11_30(tenths: int) -> int:
    """5-digit BCD as Ballard places it in bits 11–30."""
    w = bti429.BCDPutMant(0, int(tenths), 5, 0)
    return (int(w) >> 10) & 0xFFFFF


def hf_put_freq_bcd(word: int, tenths: int, *, sb: int = 0) -> int:
    """T1200 HF 037: bit 11 is SB, frequency BCD starts at bit 12.

    Ballard BCDPutMant starts at bit 11, which made 25.000 MHz read as 12.8.
    """
    field20 = _hf_bcd_bits_11_30(tenths)
    field21 = ((field20 << 1) | (1 if sb else 0)) & 0x1FFFFF
    w = int(word) & 0x3FF  # label + SDI (bits 1–10)
    return (w | (field21 << 10)) & 0xFFFFFFFF


def hf_get_freq_bcd(word: int) -> tuple[int, int]:
    """Return (mantissa, sb_bit11). Inverse of hf_put_freq_bcd."""
    field21 = (int(word) >> 10) & 0x1FFFFF
    sb = field21 & 1
    field20 = (field21 >> 1) & 0xFFFFF
    tmp = (int(word) & 0x3FF) | (field20 << 10)
    return int(bti429.BCDGetMant(tmp, 5)), sb


# T1200 ATC 031: 4 octal digits × 3 bits (Mode A), 7 pad LSBs. 4-bit BCD
# made 200 SQWK read 100 and 150 SQWK read 52.
SQUAWK_BITS = 12
SQUAWK_PAD_BITS = 7


def squawk_pad_width(spec: LabelSpec | None = None) -> int:
    n = pad_bit_count(spec.pads) if spec is not None else None
    if n is None:
        return SQUAWK_PAD_BITS
    return min(n, SQUAWK_PAD_BITS)


def squawk_pad_value(spec: LabelSpec | None = None) -> int:
    width = squawk_pad_width(spec)
    s = str(spec.pads if spec is not None else "").strip()
    if s and all(c in "01" for c in s) and s not in {"-", "--"}:
        return int(s[-width:], 2)
    return 0


def squawk_pack(code: int | float, *, pad_bits: int = SQUAWK_PAD_BITS, pad_val: int = 0) -> int:
    n = int(round(float(code))) % 10000
    data = int(pad_val) & ((1 << pad_bits) - 1)
    for i in range(4):
        digit = (n // (10 ** i)) % 10
        data |= (min(digit, 7) & 0x7) << (pad_bits + i * 3)
    return data & DATA_MASK19


def squawk_unpack(data19: int, *, pad_bits: int = SQUAWK_PAD_BITS) -> int:
    d = int(data19) >> int(pad_bits)
    n = 0
    for i in range(4):
        n += ((d >> (i * 3)) & 0x7) * (10 ** i)
    return n


# ARINC 429 BCD data (bits 11–29) holds 5 significant digits. A 6th digit
# spills into SSM and is what made T1200 label 030 (118.000 MHz) read as 60.
ARINC_BCD_DIGITS = 5
_VHF_HUNDREDTHS_MIN = 10800  # 108.00 MHz as XXX.XX
_VHF_HUNDREDTHS_MAX = 13799  # 137.99 MHz as XXX.XX
# BNR sign-magnitude (T1200 / ARINC 429). twos=1 shifts the mantissa and
# made label 203 (350 FT) read as 2800 FT when we used FldPutData.
BNR_TWOS = 0


def pad_bit_count(pads: str | None) -> int | None:
    """T1200 PADS column: a 0/1 string is unused LSBs. '-' means none given."""
    s = str(pads or "").strip()
    if s in {"", "-", "--"}:
        return None
    if all(c in "01" for c in s):
        return len(s)
    return None


def bits_from_pads(pads: str | None) -> int | None:
    """BNR significant bits = 18 magnitude bits minus pad LSBs (bit 29 is sign)."""
    n = pad_bit_count(pads)
    if n is None:
        return None
    return max(8, min(19, 18 - n))


def bnr_sigbits(spec: LabelSpec) -> int:
    derived = bits_from_pads(spec.pads)
    if derived is not None:
        return derived
    return max(1, min(19, int(spec.bnr_bits or 16)))


def encode_bnr_value(word: int, spec: LabelSpec, value: float) -> int:
    bits = bnr_sigbits(spec)
    lsb = float(spec.bnr_lsb or 1.0)
    scaled = float(value) - float(spec.bnr_offset or 0.0)
    word = bti429.BNRPutValue(scaled, int(word) & 0xFFFFFFFF, bits, lsb)
    return int(word) & 0xFFFFFFFF


def decode_bnr_value(word: int, spec: LabelSpec) -> float:
    bits = bnr_sigbits(spec)
    lsb = float(spec.bnr_lsb or 1.0)
    return float(bti429.BNRGetValue(int(word) & 0xFFFFFFFF, bits, lsb)) + float(spec.bnr_offset or 0.0)


def _is_bcd_mhz_khz(spec: LabelSpec) -> bool:
    """VHF COMM 030 / 8.33 047: MHz stored as thousandths (118.000)."""
    return spec.encoding.lower() == "bcd" and spec.units.upper() == "MHZ" and float(spec.bcd_scale or 0) >= 1000.0


def _bcd_mhz_digits(spec: LabelSpec) -> int:
    if _is_bcd_mhz_khz(spec):
        return ARINC_BCD_DIGITS
    return int(spec.bcd_digits or ARINC_BCD_DIGITS)


def decode_bcd_mhz(word: int, spec: LabelSpec) -> float:
    """Unpack VHF frequency packed the way T1200 / ARINC 716 actually send it.

    118.000 MHz as thousandths (118000) does not fit in 5 BCD digits, so T1200
    drops the hundreds digit (mantissa 18000). Reading that word with 6 digits
    yields 60 MHz. Recover:

    * mantissa 10800–13799 → hundredths of MHz (11800 → 118.00)
    * otherwise thousandths; add 100 MHz if the result is below 100
      (18000 → 18.000 → 118.000; 17992 → 117.992)
    """
    mant = int(bti429.BCDGetMant(int(word) & 0xFFFFFFFF, ARINC_BCD_DIGITS))
    if _VHF_HUNDREDTHS_MIN <= mant <= _VHF_HUNDREDTHS_MAX:
        return mant / 100.0
    scale = float(spec.bcd_scale or 1000.0)
    eng = mant / scale if scale else float(mant)
    if 0 <= eng < 100.0:
        eng += 100.0
    return eng


def encode_label(spec: LabelSpec, value: Any) -> int:
    """Build a 32-bit ARINC word for one label from an engineering value."""
    _need_bti()
    extra: dict[str, Any] = value if isinstance(value, dict) else {}
    scalar: Any = extra.get("value", extra.get("freq", extra.get("text", value))) if extra else value
    lab = parse_label(spec.label_octal)
    enc = spec.encoding.lower()
    ssm_i = resolve_ssm(str(extra.get("ssm", spec.ssm)), enc)
    sdi = int(extra.get("sdi", spec.sdi)) & 0x3

    if enc == "hf_pair":
        word_n = int(extra.get("word_index", spec.word_index) or 1)
        # bit 9 = word index (SDI bit 0); bit 10 = MOD/CW; bit 11 = SB (word 1)
        mod_bit = 1 if str(extra.get("mod", "AM")).upper() != "AM" else 0
        cw_bit = 1 if extra.get("cw") else 0
        if word_n >= 2:
            sdi = 1 | (cw_bit << 1)
        else:
            sdi = mod_bit << 1
        freq = float(scalar or extra.get("freq_mhz") or 10.0)
        if word_n >= 2:
            tenths = int(round((freq * 10000.0) % 10.0))
        else:
            tenths = int(round(freq * 1000.0))
        sb = 1 if word_n < 2 and str(extra.get("sb", "LSB")).upper() == "USB" else 0
        word = bti429.FldPutLabel(0, lab)
        word = bti429.FldPutSDI(word, sdi)
        word = hf_put_freq_bcd(word, tenths, sb=sb)
        word = put_ssm_bits(word, ssm_i)
        word = _put_parity(word, spec.parity)
        return int(word) & 0xFFFFFFFF

    word = bti429.FldPutLabel(0, lab)
    word = bti429.FldPutSDI(word, sdi)

    if enc in {"bcd_freq_khz", "bcd_tenths_khz"}:
        tenths = int(round(float(scalar) * 10.0))
        word = bti429.BCDPutMant(word, tenths, 5, 0)
        word = put_ssm_bits(word, ssm_i)
    elif enc == "bcd" and spec.units.upper() == "SQWK":
        word = put_data19(
            word,
            squawk_pack(float(scalar), pad_bits=squawk_pad_width(spec), pad_val=squawk_pad_value(spec)),
        )
        word = put_ssm_bits(word, ssm_i)
    elif enc == "dme_freq":
        data = dme_pack(
            float(scalar),
            mode=str(extra.get("mode", "DF1")),
            nav=str(extra.get("nav", "VOR")),
            disp=bool(extra.get("disp", False)),
            ident=bool(extra.get("ident", False)),
            pad_bits=extra.get("pad_bits") or extra.get("pad"),
        )
        word = put_data19(word, data)
        word = put_ssm_bits(word, ssm_i)
    elif enc == "iso5":
        text = str(scalar if scalar is not None else extra.get("text") or "")
        word = bti429.FldPutData(word, iso5_pack(text, spec.iso5_chars or 3))
        word = put_ssm_bits(word, ssm_i)
    elif enc == "bcd":
        raw_bcd = int(round(float(scalar) * spec.bcd_scale))
        word = bti429.BCDPutMant(word, raw_bcd, _bcd_mhz_digits(spec), 0)
        word = put_ssm_bits(word, ssm_i)
    elif enc == "bnr":
        word = encode_bnr_value(word, spec, float(scalar))
        word = put_ssm_bits(word, ssm_i)
    else:
        if isinstance(scalar, str) and not extra:
            raw_val = _parse_hex(scalar)
        elif isinstance(scalar, str):
            raw_val = _parse_hex(scalar)
        else:
            raw_val = int(scalar or 0) & DATA_MASK19
        word = bti429.FldPutData(word, raw_val)
        word = put_ssm_bits(word, ssm_i)

    word = _put_parity(word, spec.parity)
    return int(word) & 0xFFFFFFFF


def decode_label(spec: LabelSpec, word: int) -> dict[str, Any]:
    _need_bti()
    w = int(word) & 0xFFFFFFFF
    data19 = int(bti429.FldGetData(w)) & DATA_MASK19
    pad3, data16 = split_pad(data19)
    enc = spec.encoding.lower()
    eng_value: Any = None
    text = f"0x{data19:05X}"
    extra: dict[str, Any] = {}
    if enc in {"bcd_freq_khz", "bcd_tenths_khz"}:
        mant = int(bti429.BCDGetMant(w, 5))
        freq = mant / 10.0
        eng_value = freq
        text = f"{freq:.1f} {spec.units}".strip()
    elif enc == "dme_freq":
        extra = dme_unpack(data19)
        eng_value = extra["freq_mhz"]
        text = f"{eng_value:.2f} {spec.units} {extra['mode']}".strip()
    elif enc == "iso5":
        s = iso5_unpack(data19, spec.iso5_chars or 3)
        eng_value = s
        text = s or "—"
    elif enc == "hf_pair":
        mant, sb = hf_get_freq_bcd(w)
        sdi = int(bti429.FldGetSDI(w))
        word_n = 2 if (sdi & 1) else 1
        if word_n == 1:
            eng_value = mant / 1000.0
        else:
            eng_value = mant / 10000.0
        extra = {"word_index": word_n, "sdi": sdi, "sb": sb}
        text = f"{eng_value:.4f} {spec.units} #{word_n}".strip()
    elif enc == "bcd":
        if spec.units.upper() == "SQWK":
            data19 = get_data19(w)
            eng_value = float(squawk_unpack(data19, pad_bits=squawk_pad_width(spec)))
            text = f"{int(eng_value):04d} {spec.units}".strip()
        elif _is_bcd_mhz_khz(spec):
            eng_value = decode_bcd_mhz(w, spec)
            digits = 3 if spec.bcd_scale >= 1000 else 2
            text = f"{eng_value:.{digits}f} {spec.units}".strip()
        else:
            mant = int(bti429.BCDGetMant(w, spec.bcd_digits))
            eng_value = mant / spec.bcd_scale if spec.bcd_scale else mant
            if spec.units.upper() == "MHZ":
                digits = 3 if spec.bcd_scale >= 1000 else 2
                text = f"{eng_value:.{digits}f} {spec.units}".strip()
            elif spec.units.upper() == "FT":
                text = f"{eng_value:.1f} {spec.units}".strip()
            else:
                text = f"{eng_value} {spec.units}".strip()
    elif enc == "bnr":
        eng_value = decode_bnr_value(w, spec)
        units = spec.units
        if units.upper() == "FT":
            text = f"{eng_value:.1f} {units}".strip() if spec.bnr_lsb < 1.0 else f"{eng_value:.0f} {units}".strip()
        elif units.upper() in {"DEG", "DG", "NM", "KT", "KTS", "DDM"}:
            text = f"{eng_value:.2f} {units}".strip()
        else:
            text = f"{eng_value:g} {units}".strip()

    if spec.label_octal == "202":
        # ARINC 709 DME BNR Distance: bit 11 = MEM, bit 12 = B/F, bits 13-28 = 16-bit magnitude (LSB = 1/128 NM = 0.0078125 NM)
        mem = "ON" if ((w >> 10) & 1) else "OFF"
        bf = "F" if ((w >> 11) & 1) else "B"
        counts = (w >> 12) & 0xFFFF
        dist_nm = round(float(counts) * 0.0078125, 2)
        eng_value = dist_nm
        text = f"{dist_nm:.2f} NM"
        extra["mem"] = mem
        extra["bf"] = bf
        extra["dist_nm"] = dist_nm
    elif spec.label_octal == "201":
        d201 = decode_dme_distance_201(w)
        eng_value = d201["dist_nm"]
        text = f"{d201['dist_nm']:.2f} NM"
        extra["dist_nm"] = d201["dist_nm"]
    elif spec.label_octal == "353":
        adc = decode_vhf2100_adc_353(w)
        extra["adc"] = adc
        if adc["value"] is not None:
            eng_value = adc["value"]
            text = f"{adc['name']}: {adc['text']}"

    return {
        "label_octal": spec.label_octal,
        "funct": spec.funct,
        "data19": data19,
        "pad3": pad3,
        "data16": data16,
        "eng_value": eng_value,
        "data_text": text,
        "raw": w,
        "extra": extra,
        "units": spec.units,
    }


def _parse_hex(s: str) -> int:
    s = s.strip().lower()
    if s.startswith("0x"):
        return int(s, 16) & DATA_MASK19
    return int(s, 16 if any(c in "abcdef" for c in s) else 10) & DATA_MASK19


def safe_profile_id(profile_id: str) -> str:
    s = str(profile_id).strip().lower()
    if not _ID_RE.match(s):
        raise ValueError("profile id must start with a letter and use only a-z, 0-9, _")
    return s


def _normalize_label_payload(raw: dict[str, Any], profile_funct: str) -> dict[str, Any]:
    lab = str(raw.get("label") or raw.get("label_octal") or "000").strip()
    parse_label(lab)
    enc = str(raw.get("encoding") or "raw").lower()
    if enc not in ENCODINGS:
        raise ValueError(f"unknown encoding: {enc}")
    eng = raw.get("eng") if isinstance(raw.get("eng"), dict) else {}
    bnr = raw.get("bnr") if isinstance(raw.get("bnr"), dict) else {}
    dict_row = _labels_yaml().get(lab.zfill(3)) or {} if _label_source(raw) == "library" else {}
    units = str(raw.get("units") or eng.get("units") or dict_row.get("units") or "")
    default = raw.get("eng_default", eng.get("default", 0.0))
    out: dict[str, Any] = {
        "label": lab.zfill(3),
        "funct": str(raw.get("funct") or dict_row.get("funct") or profile_funct or ""),
        "direction": str(raw.get("direction") or "tx"),
        "source": _label_source(raw),
        "sdi": int(raw.get("sdi", 0)),
        "ssm": str(raw.get("ssm") or "NML"),
        "parity": _parity_name(raw.get("parity", raw.get("par", "ODD"))),
        "rate_ms": int(raw.get("rate_ms", 150)),
        "encoding": enc,
        "units": units,
        "word_index": int(raw.get("word_index", 1)),
        "iso5_chars": int(raw.get("iso5_chars", 3)),
        "eng": {
            "name": str(raw.get("eng_name") or eng.get("name") or dict_row.get("funct") or "value"),
            "units": units,
            "min": float(raw.get("eng_min", eng.get("min", 0.0))),
            "max": float(raw.get("eng_max", eng.get("max", 0.0))),
            "step": float(raw.get("eng_step", eng.get("step", 1.0))),
            "default": default,
        },
    }
    bus = str(raw.get("bus") or "").upper()
    if bus in ("A", "B", "C", "D"):
        out["bus"] = bus
    if enc == "bnr":
        dict_bnr = dict_row.get("bnr") if isinstance(dict_row.get("bnr"), dict) else {}
        out["bnr"] = {
            "lsb": float(raw.get("bnr_lsb", bnr.get("lsb", dict_bnr.get("lsb", 1.0)))),
            "offset": float(raw.get("bnr_offset", bnr.get("offset", 0.0))),
            "bits": int(raw.get("bnr_bits", bnr.get("bits", 16))),
        }
    if enc in {"bcd", "bcd_freq_khz", "bcd_tenths_khz", "dme_freq"}:
        default_scale = 100.0 if enc == "dme_freq" else (10.0 if enc != "bcd" else 1.0)
        out["bcd_scale"] = float(raw.get("bcd_scale", eng.get("bcd_scale", dict_row.get("bcd_scale", default_scale))))
        out["bcd_digits"] = int(raw.get("bcd_digits", eng.get("bcd_digits", dict_row.get("bcd_digits", 5))))
    return out


def save_profile(payload: dict[str, Any], *, overwrite: bool = False) -> Profile:
    pid = safe_profile_id(str(payload.get("id") or ""))
    PROFILES_DIR.mkdir(parents=True, exist_ok=True)
    path = PROFILES_DIR / f"{pid}.yaml"
    if path.is_file() and not overwrite:
        raise FileExistsError(f"profile already exists: {pid}")
    labels_in = payload.get("labels") or []
    if not isinstance(labels_in, list) or not labels_in:
        raise ValueError("profile needs at least one label")
    tx_ch = channel_letter(payload.get("tx_ch") or payload.get("bus") or "A")
    rx_ch = channel_letter(payload.get("rx_ch") or payload.get("bus") or tx_ch)
    funct = str(payload.get("funct") or payload.get("name") or pid).strip()
    doc = {
        "id": pid,
        "name": str(payload.get("name") or pid).strip() or pid,
        "funct": funct,
        "arinc_characteristic": str(payload.get("characteristic") or payload.get("arinc_characteristic") or ""),
        "mode": str(payload.get("mode") or "standard"),
        "bus": tx_ch,
        "tx_ch": tx_ch,
        "rx_ch": rx_ch,
        "high_speed": bool(payload.get("high_speed", False)),
        "notes": str(payload.get("notes") or "").strip(),
        "labels": [_normalize_label_payload(dict(x), funct) for x in labels_in],
    }
    path.write_text(yaml.safe_dump(doc, sort_keys=False, allow_unicode=True), encoding="utf-8")
    try:
        from ate_platform.device.label_dict import invalidate_label_cache
        invalidate_label_cache()
    except Exception:
        pass
    return load_profile(pid)


def delete_profile(profile_id: str) -> None:
    pid = safe_profile_id(profile_id)
    path = PROFILES_DIR / f"{pid}.yaml"
    if not path.is_file():
        raise FileNotFoundError(f"Unknown profile: {pid}")
    path.unlink()
    try:
        from ate_platform.device.label_dict import invalidate_label_cache
        invalidate_label_cache()
    except Exception:
        pass
