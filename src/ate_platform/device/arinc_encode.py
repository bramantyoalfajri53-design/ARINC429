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
