"""ARINC 429 word encode/decode (raw fields + LRU profiles)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

try:
    from btidriver import bti429
except ImportError:  # pragma: no cover
    class _SimBti429:
        @staticmethod
        def FldPutLabel(w, lab): return (int(w) & ~0xFF) | (int(lab) & 0xFF)
        @staticmethod
        def FldGetLabel(w): return int(w) & 0xFF
        @staticmethod
        def FldPutSDI(w, sdi): return (int(w) & ~(0x3 << 8)) | ((int(sdi) & 0x3) << 8)
        @staticmethod
        def FldGetSDI(w): return (int(w) >> 8) & 0x3
        @staticmethod
        def FldPutData(w, data): return (int(w) & ~(0x7FFFF << 10)) | ((int(data) & 0x7FFFF) << 10)
        @staticmethod
        def FldGetData(w): return (int(w) >> 10) & 0x7FFFF
        @staticmethod
        def BCDPutSSM(w, ssm): return (int(w) & ~(0x3 << 29)) | ((int(ssm) & 0x3) << 29)
        @staticmethod
        def BCDGetSSM(w): return (int(w) >> 29) & 0x3
        @staticmethod
        def BNRPutSSM(w, ssm): return (int(w) & ~(0x3 << 29)) | ((int(ssm) & 0x3) << 29)
        @staticmethod
        def BNRGetSSM(w): return (int(w) >> 29) & 0x3
        @staticmethod
        def FldPutParBit(w):
            w = int(w) & 0x7FFFFFFF
            cnt = bin(w).count('1')
            par = 0 if (cnt % 2 == 1) else 1
            return w | (par << 31)
        @staticmethod
        def BCDPutMant(w, val, digits, dec=0):
            v = int(val); bcd = 0; shift = 0
            while v > 0 and shift < (digits * 4):
                bcd |= ((v % 10) << shift); v //= 10; shift += 4
            return (int(w) & ~(0x7FFFF << 10)) | ((bcd & 0x7FFFF) << 10)
        @staticmethod
        def BCDGetMant(w, digits, dec=0):
            bcd = (int(w) >> 10) & 0x7FFFF; val = 0; mult = 1
            for _ in range(digits): val += (bcd & 0xF) * mult; mult *= 10; bcd >>= 4
            return val
        @staticmethod
        def BNRPutValue(val, w, bits, lsb):
            counts = int(round(float(val) / float(lsb or 1.0)))
            mask = (1 << bits) - 1
            c = (counts + (1 << bits)) & mask if counts < 0 else (counts & mask)
            shift = 29 - bits
            return (int(w) & ~(mask << shift)) | (c << shift)
        @staticmethod
        def BNRGetValue(w, bits, lsb):
            shift = 29 - bits
            mask = (1 << bits) - 1
            raw = (int(w) >> shift) & mask
            if raw & (1 << (bits - 1)):
                raw -= (1 << bits)
            return float(raw) * float(lsb or 1.0)

    bti429 = _SimBti429()


SSM_NAMES = {
    0: "FAIL",
    1: "NCD",
    2: "FT",
    3: "NML",
}
# ARINC bits 30–31 via BCDGetSSM (2 bits). BNRGetSSM is 3 bits and showed "6" for NML.
# BNR: 00=FW 01=NCD 10=FT 11=NO(NML)
# BCD: 00=Plus 01=NCD 10=FT 11=Minus — T1200 still labels Plus as NML on 030/047/032.
_BCD_SSM_ENCODINGS = {"bcd", "bcd_freq_khz", "bcd_tenths_khz", "hf_pair"}
_PLUS_SSM = {"NML", "PLS", "PLUS", "N.", "E.", "INT", "NORM"}
_MINUS_SSM = {"FAIL", "FW", "UND", "MIN", "MINUS"}
SSM_CODES = {
    "NML": 3, "PLS": 0, "PLUS": 0, "INT": 3, "NORM": 3,
    "NCD": 1,
    "FT": 2, "TEST": 2,
    "FAIL": 0, "UND": 0, "FW": 0, "MIN": 3, "MINUS": 3,
    "N.": 0, "E.": 0,
}

DATA_MASK19 = 0x7FFFF
PAD_MASK3 = 0x7  # bits 11-13 (low 3 bits of the 19-bit data field)
DATA_HI_MASK16 = 0x7FFF  # bits 14-29 (high 16 bits of data19)


def put_data19(word: int, data19: int) -> int:
    """ARINC bits 11–29. FldPutData starts at bit 9 and overwrites SDI."""
    w = int(word) & ~(DATA_MASK19 << 10)
    return (w | ((int(data19) & DATA_MASK19) << 10)) & 0xFFFFFFFF


def get_data19(word: int) -> int:
    return (int(word) >> 10) & DATA_MASK19


def _need_bti() -> None:
    if bti429 is None:
        raise ImportError("btidriver required for ARINC encode/decode")


def resolve_ssm(ssm: int | str, encoding: str = "bnr") -> int:
    """2-bit ARINC SSM. BCD Plus/NML is 00; BNR NML is 11."""
    if not isinstance(ssm, str):
        return int(ssm) & 0x3
    key = ssm.strip().upper()
    bcd = encoding.lower() in _BCD_SSM_ENCODINGS
    if key in {"NCD"}:
        return 1
    if key in {"FT", "TEST"}:
        return 2
    if bcd:
        return 0 if key in _PLUS_SSM else 3
    return 3 if key in _PLUS_SSM else 0


def get_ssm_bits(word: int) -> int:
    """Bits 30–31 only. Do not use BNRGetSSM (that includes bit 29 → 6 for NML)."""
    _need_bti()
    return int(bti429.BCDGetSSM(int(word) & 0xFFFFFFFF)) & 0x3


def put_ssm_bits(word: int, bits: int) -> int:
    _need_bti()
    return int(bti429.BCDPutSSM(int(word) & 0xFFFFFFFF, int(bits) & 0x3)) & 0xFFFFFFFF


def ssm_name_from_bits(bits: int, encoding: str = "bnr", home_ssm: str | None = None) -> str:
    """Map 2-bit SSM to the T1200 name for this label (NML vs PLS on BCD Plus)."""
    bits = int(bits) & 0x3
    enc = (encoding or "bnr").lower()
    home = (home_ssm or "").strip().upper()
    if bits == 1:
        return "NCD"
    if bits == 2:
        return "FT"
    if enc in _BCD_SSM_ENCODINGS:
        if bits == 0:
            return home if home in _PLUS_SSM else "PLS"
        return "MIN"
    if bits == 3:
        return home if home in _PLUS_SSM else "NML"
    return home if home in _MINUS_SSM else "FAIL"


def parse_label(label: int | str) -> int:
    """Accept int, decimal string, or octal string (e.g. '032', '0o32', '201')."""
    if isinstance(label, int):
        val = label
    else:
        s = str(label).strip().lower()
        if s.startswith("0o"):
            val = int(s, 8)
        elif s.startswith("0x"):
            val = int(s, 16)
        elif s.isdigit() and (s.startswith("0") or int(s) > 255):
            # Prefer octal for classic ARINC labels like 032 / 377
            try:
                val = int(s, 8)
            except ValueError:
                val = int(s, 10)
        else:
            # Ambiguous 1–3 digit: treat as octal (ARINC convention)
            try:
                val = int(s, 8)
            except ValueError:
                val = int(s, 10)
    if not (0 <= val <= 0o377):
        raise ValueError(f"Label out of range 000–377 octal: {label!r}")
    return val


def parse_data19(data: int | str) -> int:
    if isinstance(data, int):
        val = data
    else:
        s = str(data).strip().lower().replace("_", "")
        if not s:
            val = 0
        elif s.startswith(("0x", "0o", "0b")):
            val = int(s, 0)
        elif any(c in "abcdef" for c in s):
            val = int(s, 16)
        else:
            # Prefer hex for data field (ARINC tools convention)
            try:
                val = int(s, 16)
            except ValueError:
                val = int(s, 10)
    if not (0 <= val <= 0x7FFFF):
        raise ValueError(f"Data field must fit 19 bits (0..0x7FFFF): {data!r}")
    return val


def label_octal_str(label: int) -> str:
    return format(int(label) & 0xFF, "o").zfill(3)


def format_pads(data19: int, pads_tmpl: str | None) -> str:
    """RX/TX PADS column: actual unused LSB pattern, width from the T1200 template."""
    s = str(pads_tmpl or "").strip()
    if s in {"", "-", "--"}:
        return "-"
    if not all(c in "01" for c in s):
        return s
    n = len(s)
    return format(int(data19) & ((1 << n) - 1), f"0{n}b")


def split_pad(data19: int) -> tuple[int, int]:
    """Return (pad3, data16) from a 19-bit data field (pad = bits 11-13)."""
    d = int(data19) & DATA_MASK19
    return d & PAD_MASK3, (d >> 3) & DATA_HI_MASK16


def join_pad(pad3: int, data16: int) -> int:
    """Combine pad (bits 11-13) and data (bits 14-29) into data19."""
    return ((int(data16) & DATA_HI_MASK16) << 3) | (int(pad3) & PAD_MASK3)


@dataclass
class DecodedWord:
    label_octal: str
    label: int
    sdi: int
    ssm: int
    ssm_name: str
    parity_odd: bool
    raw: int
    data19: int
    pad3: int
    data16: int
    funct: str
    data_text: str
    engineering: dict[str, Any]


def word_parity_odd(word: int) -> bool:
    """ARINC 429 PAR is odd/even over all 32 bits, not the raw value of bit 32.

    FldGetParity returns bit 32. A legal odd-parity word can have bit 32 clear
    (bits 1–31 already odd), which made RX show EVEN while TX was ODD.
    """
    return bin(int(word) & 0xFFFFFFFF).count("1") & 1 == 1


def encode_raw_word(
    label: int | str,
    data: int | str = 0,
    *,
    sdi: int = 0,
    ssm: int | str = 0,
    odd_parity: bool = True,
) -> int:
    """Build a 32-bit ARINC 429 word from Label / SDI / Data(19) / SSM / Parity."""
    _need_bti()
    lab = parse_label(label)
    data19 = parse_data19(data)
    ssm_i = resolve_ssm(ssm, "bnr")
    word = bti429.FldPutLabel(0, lab)
    word = bti429.FldPutSDI(word, int(sdi) & 0x3)
    word = bti429.FldPutData(word, data19)
    word = put_ssm_bits(word, ssm_i)
    word = bti429.FldPutParBit(word)
    if not odd_parity:
        word ^= 1 << 31
    return int(word) & 0xFFFFFFFF


def encode_adf_freq_032(
    freq_khz: float,
    *,
    sdi: int = 0,
    ssm: int | str = 0,
) -> int:
    """Encode ADF frequency as ARINC label 032 (BCD, tenths of kHz)."""
    _need_bti()
    if not (100.0 <= float(freq_khz) <= 1799.9):
        raise ValueError(f"ADF frequency out of range: {freq_khz} kHz")
    ssm_i = resolve_ssm(ssm, "bcd")
    tenths = int(round(float(freq_khz) * 10.0))
    word = bti429.FldPutLabel(0, 0o032)
    word = bti429.FldPutSDI(word, int(sdi) & 0x3)
    word = bti429.BCDPutMant(word, tenths, 5, 0)
    word = put_ssm_bits(word, ssm_i)
    word = bti429.FldPutParBit(word)
    return int(word) & 0xFFFFFFFF


def decode_adf_freq_032(word: int) -> DecodedWord:
    _need_bti()
    w = int(word) & 0xFFFFFFFF
    label = int(bti429.FldGetLabel(w))
    sdi = int(bti429.FldGetSDI(w))
    ssm = get_ssm_bits(w)
    data19 = int(bti429.FldGetData(w)) & DATA_MASK19
    mant = int(bti429.BCDGetMant(w, 5))
    freq = mant / 10.0
    parity_odd = word_parity_odd(w)
    pad3, data16 = split_pad(data19)
    return DecodedWord(
        label_octal=label_octal_str(label),
        label=label,
        sdi=sdi,
        ssm=ssm,
        ssm_name=ssm_name_from_bits(ssm, "bcd", "NML"),
        parity_odd=parity_odd,
        raw=w,
        data19=data19,
        pad3=pad3,
        data16=data16,
        funct="ADF",
        data_text=f"{freq:.1f} KHZ",
        engineering={"freq_khz": freq},
    )


def decode_word(word: int, *, profile: str = "auto") -> DecodedWord:
    """Decode raw word; auto-detect label 032 as ADF freq."""
    _need_bti()
    w = int(word) & 0xFFFFFFFF
    label = int(bti429.FldGetLabel(w))
    if profile != "none" and profile in {"auto", "adf_032"} and label == 0o032:
        return decode_adf_freq_032(w)
    sdi = int(bti429.FldGetSDI(w))
    ssm = get_ssm_bits(w)
    data19 = int(bti429.FldGetData(w)) & DATA_MASK19
    parity_odd = word_parity_odd(w)
    pad3, data16 = split_pad(data19)
    return DecodedWord(
        label_octal=label_octal_str(label),
        label=label,
        sdi=sdi,
        ssm=ssm,
        ssm_name=ssm_name_from_bits(ssm, "bnr"),
        parity_odd=parity_odd,
        raw=w,
        data19=data19,
        pad3=pad3,
        data16=data16,
        funct="RAW",
        data_text=f"0x{data19:05X}",
        engineering={"data19": data19},
    )


def dissect_arinc_word(word: int) -> dict[str, Any]:
    """Dissect a 32-bit ARINC 429 word into constituent fields with binary & parity checks."""
    w = int(word) & 0xFFFFFFFF
    lab = w & 0xFF
    lab_oct = format(lab, "o").zfill(3)
    sdi = (w >> 8) & 0x3
    data19 = (w >> 10) & 0x7FFFF
    ssm = (w >> 29) & 0x3
    p_bit = (w >> 31) & 1
    
    popcount = bin(w).count("1")
    is_odd = (popcount % 2 == 1)
    
    bin_p = format(p_bit, "01b")
    bin_ssm = format(ssm, "02b")
    bin_data = format(data19, "019b")
    bin_sdi = format(sdi, "02b")
    bin_label = format(lab, "08b")
    
    formatted_bin = f"{bin_p} | {bin_ssm} | {bin_data} | {bin_sdi} | {bin_label}"
    
    return {
        "raw": w,
        "hex": f"0x{w:08X}",
        "label": lab,
        "label_octal": lab_oct,
        "sdi": sdi,
        "data19": data19,
        "ssm": ssm,
        "p_bit": p_bit,
        "parity_odd": is_odd,
        "parity_status": "ODD_OK" if is_odd else "PARITY_ERROR",
        "bin_p": bin_p,
        "bin_ssm": bin_ssm,
        "bin_data": bin_data,
        "bin_sdi": bin_sdi,
        "bin_label": bin_label,
        "formatted_bin": formatted_bin,
    }


def encode_dme_frequency_035(
    freq_mhz: float = 134.40,
    *,
    mode: str = "DF1",
    sdi: int = 0,
    disp: bool = True,
    ident: bool = False,
    nav: str = "VOR",
    ssm: int = 0,
    odd_parity: bool = True,
) -> int:
    """Encode ARINC 709 DME Frequency word (Label 035).
    
    Parameters per ARINC 709 / Aeroflex JcAIR T1200B:
    - Label 035 (bits 1-8)
    - SDI (bits 9-10): default 00 (All Call)
    - Mode (bits 11-13 / data19 bits 0-2): 001 for DF1
    - Nav (bits 14-15 / data19 bits 3-4): 00 for VOR
    - DISP (bit 16 / data19 bit 5): 1 (requests BCD distance)
    - IDENT (bit 17 / data19 bit 6): 0 or 1
    - Frequency (bits 18-29 / data19 bits 7-18): 12-bit BCD (108.00 - 135.95 MHz)
    - SSM (bits 30-31): default 00 (Normal Operation)
    - Parity (bit 32): Odd Parity
    """
    _need_bti()
    mhz_int = int(freq_mhz)
    fract = int(round((freq_mhz - mhz_int) * 100))
    bit_50k = 1 if (fract % 10 == 5) else 0
    b_100k = (fract // 10) & 0xF
    b_1m = (mhz_int % 10) & 0xF
    b_10m = ((mhz_int // 10) % 10) & 0x7
    freq12 = (b_10m << 9) | (b_1m << 5) | (b_100k << 1) | bit_50k
    
    mode_map = {"STBY": 0, "DF1": 1, "DF2": 2, "DF3": 3, "DF4": 4, "DF5": 5, "SCAN": 6}
    m_val = mode_map.get(str(mode).upper(), 1) & 0x7
    nav_map = {"VOR": 0, "ILS": 1, "MLS": 2, "UND": 3}
    n_val = (nav_map.get(str(nav).upper(), 0) & 0x3) << 3
    d_val = (1 if disp else 0) << 5
    i_val = (1 if ident else 0) << 6
    p_val = m_val | n_val | d_val | i_val
    
    data19 = (freq12 << 7) | p_val
    
    word = bti429.FldPutLabel(0, 0o035)
    word = bti429.FldPutSDI(word, int(sdi) & 0x3)
    word = bti429.FldPutData(word, data19)
    word = bti429.BCDPutSSM(word, int(ssm) & 0x3)
    word = bti429.FldPutParBit(word)
    if not odd_parity:
        word ^= 1 << 31
    return int(word) & 0xFFFFFFFF


def decode_dme_frequency_035(word_or_data19: int) -> dict[str, Any]:
    """Decode ARINC 709 DME Frequency word (Label 035) or its 19-bit data field."""
    val = int(word_or_data19)
    if val > 0x7FFFF:
        data19 = (val >> 10) & 0x7FFFF
        sdi = (val >> 8) & 0x3
        ssm = (val >> 29) & 0x3
        parity_odd = word_parity_odd(val)
    else:
        data19 = val & 0x7FFFF
        sdi = 0
        ssm = 0
        parity_odd = True

    mode_bits = data19 & 0x7
    nav_bits = (data19 >> 3) & 0x3
    disp_bit = (data19 >> 5) & 1
    ident_bit = (data19 >> 6) & 1

    freq12 = (data19 >> 7) & 0xFFF
    bit_50k = freq12 & 1
    b_100k = (freq12 >> 1) & 0xF
    b_1m = (freq12 >> 5) & 0xF
    b_10m = (freq12 >> 9) & 0x7
    freq_mhz = round(100.0 + (b_10m * 10.0) + b_1m + (b_100k * 0.1) + (bit_50k * 0.05), 2)

    mode_map_inv = {0: "STBY", 1: "DF1", 2: "DF2", 3: "DF3", 4: "DF4", 5: "DF5", 6: "SCAN"}
    nav_map_inv = {0: "VOR", 1: "ILS", 2: "MLS", 3: "UND"}

    return {
        "freq_mhz": freq_mhz,
        "mode": mode_map_inv.get(mode_bits, f"M{mode_bits}"),
        "nav": nav_map_inv.get(nav_bits, "UND"),
        "disp": bool(disp_bit),
        "ident": bool(ident_bit),
        "sdi": sdi,
        "ssm": ssm,
        "pad_bits": data19 & 0x7F,
        "pads": format(data19 & 0x7F, "07b"),
        "parity_odd": parity_odd,
    }


def decode_dme_distance_202(word: int) -> dict[str, Any]:
    """Decode ARINC 709 DME BNR Distance (Label 202).
    
    Bits 14-29 (16 bits) encode distance in NM (LSB = 0.0048828125 NM or 1/128 NM).
    Bits 30-31 SSM: 11=NML, 01=NCD, 10=FT, 00=FW/FAIL.
    """
    _need_bti()
    w = int(word) & 0xFFFFFFFF
    label = int(bti429.FldGetLabel(w))
    sdi = int(bti429.FldGetSDI(w))
    ssm = get_ssm_bits(w)
    ssm_names = {3: "NML", 1: "NCD", 2: "FT", 0: "FAIL"}
    ssm_str = ssm_names.get(ssm, "FAIL")
    
    mask16 = 0xFFFF
    counts = (w >> 13) & mask16
    dist_nm = round(float(counts) * 0.0048828125, 2)
    if dist_nm > 400.0:
        dist_nm = round(float(counts) * (1.0 / 128.0), 2)
        
    parity_odd = word_parity_odd(w)
    return {
        "label": label,
        "label_octal": label_octal_str(label),
        "sdi": sdi,
        "ssm": ssm,
        "ssm_name": ssm_str,
        "dist_nm": dist_nm,
        "dist_text": f"{dist_nm:.1f} NM" if ssm_str != "NCD" else "NCD",
        "parity_odd": parity_odd,
        "raw": w,
    }


def decode_dme_distance_201(word: int) -> dict[str, Any]:
    """Decode ARINC 709 DME BCD Distance (Label 201).
    
    4 or 5 BCD digits in data19: tenths or hundredths of NM.
    Bits 30-31 SSM: 00=Plus(NML), 01=NCD, 10=FT, 11=Minus.
    """
    _need_bti()
    w = int(word) & 0xFFFFFFFF
    label = int(bti429.FldGetLabel(w))
    sdi = int(bti429.FldGetSDI(w))
    ssm = get_ssm_bits(w)
    ssm_names = {0: "NML", 1: "NCD", 2: "FT", 3: "FAIL"}
    ssm_str = ssm_names.get(ssm, "FAIL")
    
    try:
        mant = int(bti429.BCDGetMant(w, 5))
        dist_nm = round(mant / 100.0, 2)
        if dist_nm > 400.0:
            dist_nm = round(mant / 10.0, 1)
    except Exception:
        dist_nm = 0.0
        
    parity_odd = word_parity_odd(w)
    return {
        "label": label,
        "label_octal": label_octal_str(label),
        "sdi": sdi,
        "ssm": ssm,
        "ssm_name": ssm_str,
        "dist_nm": dist_nm,
        "dist_text": f"{dist_nm:.1f} NM" if ssm_str != "NCD" else "NCD",
        "parity_odd": parity_odd,
        "raw": w,
    }
