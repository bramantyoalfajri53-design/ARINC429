"""ARINC 429 32-bit word codec and JcAIR T1200/T1200B protocol encoders/decoders."""

from __future__ import annotations

from dataclasses import dataclass

SSM_MAP = {
    "FW": 0b00,   # Failure Warning / Plus / No Computed depending on BNR/BCD
    "NCD": 0b01,  # No Computed Data
    "FT": 0b10,   # Functional Test
    "NO": 0b11,   # Normal Operation
}
SSM_REVERSE = {v: k for k, v in SSM_MAP.items()}


def reverse_label_bits(label_byte: int) -> int:
    """Reverse 8-bit order for ARINC 429 wire transmission (bit 1..8)."""
    val = label_byte & 0xFF
    out = 0
    for _ in range(8):
        out = (out << 1) | (val & 1)
        val >>= 1
    return out


def parse_octal_label(label_oct: str) -> int:
    """Parse a 3-digit octal ARINC 429 label string (000..377)."""
    cleaned = label_oct.strip()
    if not cleaned:
        raise ValueError("Empty ARINC 429 label")
    val = int(cleaned, 8)
    if not 0 <= val <= 0o377:
        raise ValueError(f"ARINC 429 octal label out of range (000..377): {label_oct}")
    return val


def format_octal_label(label_byte: int) -> str:
    """Format 8-bit label integer into 3-digit zero-padded octal string."""
    return f"{label_byte & 0xFF:03o}"


def parse_sdi(sdi: str | int) -> int:
    """Parse 2-bit SDI from binary string ('00'..'11') or integer."""
    if isinstance(sdi, int):
        if 0 <= sdi <= 3:
            return sdi
        raise ValueError(f"SDI integer out of range: {sdi}")
    cleaned = sdi.strip()
    if cleaned not in {"00", "01", "10", "11"}:
        raise ValueError(f"Invalid SDI binary string: {sdi}")
    return int(cleaned, 2)


def compute_parity_bit(word_31bits: int, parity_mode: str = "ODD") -> int:
    """Compute bit 32 (MSB) parity for the lower 31 bits of an ARINC 429 word."""
    ones = (word_31bits & 0x7FFFFFFF).bit_count()
    mode = parity_mode.upper()
    if mode == "ODD":
        return 0 if (ones % 2 == 1) else 1
    if mode == "EVEN":
        return 0 if (ones % 2 == 0) else 1
    raise ValueError(f"Invalid parity mode: {parity_mode}")


@dataclass(frozen=True)
class DecodedArincWord:
    raw: int
    hex_word: str
    label_oct: str
    sdi: str
    data_hex: str
    data_19bit: int
    ssm: str
    parity: str
    parity_ok: bool


def encode_arinc429_word(
    label_oct: str,
    sdi: str | int = "00",
    data_19bit: int = 0,
    ssm: str | int = "NO",
    parity: str = "ODD",
) -> int:
    """Encode label, SDI, 19-bit data, SSM, and parity into a 32-bit ARINC 429 word."""
    label_val = parse_octal_label(label_oct)
    wire_label = reverse_label_bits(label_val)
    sdi_val = parse_sdi(sdi)
    data_val = int(data_19bit) & 0x7FFFF
    if isinstance(ssm, str):
        ssm_val = SSM_MAP.get(ssm.upper(), 0b11)
    else:
        ssm_val = int(ssm) & 0b11

    word_31 = wire_label | (sdi_val << 8) | (data_val << 10) | (ssm_val << 29)
    p_bit = compute_parity_bit(word_31, parity)
    return (word_31 | (p_bit << 31)) & 0xFFFFFFFF


def decode_arinc429_word(raw: int, expected_parity: str = "ODD") -> DecodedArincWord:
    """Decode a 32-bit ARINC 429 integer word into human-readable avionics fields."""
    word = raw & 0xFFFFFFFF
    wire_label = word & 0xFF
    label_val = reverse_label_bits(wire_label)
    sdi_val = (word >> 8) & 0b11
    data_val = (word >> 10) & 0x7FFFF
    ssm_val = (word >> 29) & 0b11
    p_bit = (word >> 31) & 1

    expected_p = compute_parity_bit(word & 0x7FFFFFFF, expected_parity)
    return DecodedArincWord(
        raw=word,
        hex_word=f"{word:08X}",
        label_oct=format_octal_label(label_val),
        sdi=f"{sdi_val:02b}",
        data_hex=f"{data_val:05X}",
        data_19bit=data_val,
        ssm=SSM_REVERSE.get(ssm_val, "NO"),
        parity="EVEN" if expected_parity.upper() == "EVEN" else "ODD",
        parity_ok=(p_bit == expected_p),
    )


def encode_cfds_command_227(
    lru_code_hex: str,
    cmd_code: int,
    sdi: str = "00",
    ssm: str = "NO",
) -> int:
    """Encode CFDS/BITE Command Word (Label 227).

    Carries LRU equipment code (lower 8/12 bits of data field) and BITE command bits.
    """
    lru_val = int(lru_code_hex, 16) & 0xFF
    data_19 = ((cmd_code & 0x3FF) << 9) | (lru_val & 0x1FF)
    return encode_arinc429_word("227", sdi=sdi, data_19bit=data_19, ssm=ssm, parity="ODD")


def encode_cmc_command_227(
    sensor_code_hex: str,
    function_code: int,
    ground_test_enable: bool,
    inflight_test_enable: bool,
    sdi: str = "00",
) -> int:
    """Encode Boeing CMC Command Summary Word (Label 227, D243W201-1)."""
    sensor_val = int(sensor_code_hex.replace("0x", ""), 16) & 0xFF
    flags = (1 if ground_test_enable else 0) | ((1 if inflight_test_enable else 0) << 1)
    data_19 = ((function_code & 0x1F) << 14) | ((flags & 0b11) << 10) | sensor_val
    return encode_arinc429_word("227", sdi=sdi, data_19bit=data_19, ssm="NO", parity="ODD")


def encode_cmc_fault_summary_word(
    label_oct: str,
    active_fault_bits: list[int],
    command_ack: bool,
    sdi: str = "00",
) -> int:
    """Encode Boeing CMC Fault Summary Word #1 (350) or #2 (351).

    Bits 11..28 represent individual LRU fault flags (1-indexed ARINC bit numbering).
    Bit 29 represents Command Word Acknowledge (ACK = 1, NAK/Unack = 0).
    """
    data_19 = 0
    for bit_num in active_fault_bits:
        if 11 <= bit_num <= 28:
            data_19 |= 1 << (bit_num - 11)
    if command_ack:
        data_19 |= 1 << (29 - 11)  # Bit 29 is bit index 18 inside 19-bit data field
    return encode_arinc429_word(label_oct, sdi=sdi, data_19bit=data_19, ssm="NO", parity="ODD")


def decode_cmc_fault_summary_word(raw: int) -> dict[str, object]:
    """Decode Fault Summary Word #1/#2 including bits 11..28 and Bit 29 ACK."""
    decoded = decode_arinc429_word(raw)
    data_19 = decoded.data_19bit
    active_bits = [b for b in range(11, 29) if (data_19 >> (b - 11)) & 1]
    bit_29_ack = bool((data_19 >> (29 - 11)) & 1)
    return {
        "label": decoded.label_oct,
        "raw_hex": decoded.hex_word,
        "active_fault_bits": active_bits,
        "bit_29_ack": bit_29_ack,
        "ssm": decoded.ssm,
    }


def encode_iso5_pair_356(char1: str, char2: str, seq_ctrl: int = 0) -> int:
    """Encode two 7-bit ISO #5 characters plus sequence control in Label 356."""
    c1 = ord(char1[0]) & 0x7F if char1 else 0
    c2 = ord(char2[0]) & 0x7F if char2 else 0
    data_19 = ((seq_ctrl & 0x1F) << 14) | (c2 << 7) | c1
    return encode_arinc429_word("356", sdi="00", data_19bit=data_19, ssm="NO", parity="ODD")


def decode_iso5_pair_356(raw: int) -> tuple[str, str, int]:
    """Decode two 7-bit ISO #5 characters and sequence bits from Label 356 word."""
    decoded = decode_arinc429_word(raw)
    data_19 = decoded.data_19bit
    c1 = chr(data_19 & 0x7F) if (data_19 & 0x7F) >= 32 else ""
    c2 = chr((data_19 >> 7) & 0x7F) if ((data_19 >> 7) & 0x7F) >= 32 else ""
    seq_ctrl = (data_19 >> 14) & 0x1F
    return c1, c2, seq_ctrl

