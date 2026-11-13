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
    sensor_code_hex: str = "007",
    function_code: int = 0,
    pad: int = 0,
    sdi: str = "00",
    parity: str = "ODD",
    ground_test_enable: bool | None = None,
    inflight_test_enable: bool | None = None,
) -> int:
    """Encode Boeing CMC Command Summary Word (Label 227, D243W201-1 / ARINC 604-1).

    Bit structure (32-bit ARINC 429 word):
    - Bits 1..8:   Label 227 octal (wire-reversed)
    - Bits 9..10:  SDI (00=ALL, 01=1/LEFT, 10=2/RIGHT, 11=3/CENTER)
    - Bits 11..12: PAD (default 00)
    - Bits 13..24: Equipment ID (12 bits = 3 hex digits, 000-FFF)
    - Bits 25..31: Function Code (7 bits, e.g. 00H, 01H, 03H, 12H, 7FH)
    - Bit 32:      Parity (ODD/EVEN)
    """
    clean_hex = sensor_code_hex.replace("0x", "").replace("0X", "").strip() or "007"
    eq_id_val = int(clean_hex, 16) & 0xFFF
    fn_val = int(function_code) & 0x7F
    pad_val = int(pad) & 0x03
    sdi_val = parse_sdi(sdi)

    label_rev = reverse_label_bits(parse_octal_label("227"))
    word_31 = (
        (label_rev & 0xFF)
        | (sdi_val << 8)
        | (pad_val << 10)
        | (eq_id_val << 12)
        | (fn_val << 24)
    )
    p_bit = compute_parity_bit(word_31, parity)
    return (word_31 | (p_bit << 31)) & 0xFFFFFFFF


def decode_cmc_command_227(raw: int, expected_parity: str = "ODD") -> dict[str, object]:
    """Decode Boeing CMC Command Summary Word (Label 227)."""
    word = raw & 0xFFFFFFFF
    wire_label = word & 0xFF
    label_oct = format_octal_label(reverse_label_bits(wire_label))
    sdi_val = (word >> 8) & 0b11
    pad_val = (word >> 10) & 0b11
    eq_id_val = (word >> 12) & 0xFFF
    fn_val = (word >> 24) & 0x7F
    p_bit = (word >> 31) & 1

    expected_p = compute_parity_bit(word & 0x7FFFFFFF, expected_parity)
    sdi_names = {0: "ALL", 1: "LEFT (1)", 2: "RIGHT (2)", 3: "CENTER (3)"}

    return {
        "label": label_oct,
        "sdi_bin": f"{sdi_val:02b}",
        "sdi_name": sdi_names.get(sdi_val, "ALL"),
        "pad": f"{pad_val:02b}",
        "eq_id": f"{eq_id_val:03X}",
        "function_code": fn_val,
        "function_hex": f"{fn_val:02X}H",
        "parity": "EVEN" if expected_parity.upper() == "EVEN" else "ODD",
        "parity_ok": (p_bit == expected_p),
        "raw_hex": f"{word:08X}",
    }


def encode_cmc_fault_summary_word(
    label_oct: str = "350",
    active_fault_bits: list[int] | None = None,
    command_ack: bool = True,
    bite_test_inhibit: bool = False,
    sdi: str = "00",
    ssm: str = "00",
    parity: str = "ODD",
) -> int:
    """Encode Boeing CMC Fault Summary Word #1 (350) or #2 (351).

    Bit structure (32-bit ARINC 429 word):
    - Bits 1..8:   Label 350 / 351 (wire-reversed)
    - Bits 9..10:  SDI (00=ALL, 01=LEFT, 10=RIGHT, 11=CENTER)
    - Bits 11..27: Fault Data (17 bits, 0=OK, 1=FAILURE or SPARE)
    - Bit 28:      BITE TEST INHIBIT (0=ENABLE, 1=INHIBIT)
    - Bit 29:      CMND WORD ACKNOWLEDGE (0=NAK, 1=ACK)
    - Bits 30..31: SSM (00=VERIFIED, 01=NO COMPUTED DATA, 10=FUNCTIONAL TEST, 11=NOT DEFINED)
    - Bit 32:      Parity (ODD/EVEN)
    """
    label_val = parse_octal_label(label_oct)
    wire_label = reverse_label_bits(label_val)
    sdi_val = parse_sdi(sdi)
    ssm_val = int(ssm, 2) & 0b11 if isinstance(ssm, str) else int(ssm) & 0b11

    data_19 = 0
    if active_fault_bits:
        for bit_num in active_fault_bits:
            if 11 <= bit_num <= 28:
                data_19 |= 1 << (bit_num - 11)
    if bite_test_inhibit:
        data_19 |= 1 << (28 - 11)
    if command_ack:
        data_19 |= 1 << (29 - 11)

    word_31 = wire_label | (sdi_val << 8) | (data_19 << 10) | (ssm_val << 29)
    p_bit = compute_parity_bit(word_31, parity)
    return (word_31 | (p_bit << 31)) & 0xFFFFFFFF


def decode_cmc_fault_summary_word(raw: int, expected_parity: str = "ODD") -> dict[str, object]:
    """Decode Fault Summary Word #1 (350) / #2 (351) per Boeing D243W201-1."""
    word = raw & 0xFFFFFFFF
    wire_label = word & 0xFF
    label_oct = format_octal_label(reverse_label_bits(wire_label))
    sdi_val = (word >> 8) & 0b11
    data_19 = (word >> 10) & 0x7FFFF
    ssm_val = (word >> 29) & 0b11
    p_bit = (word >> 31) & 1

    expected_p = compute_parity_bit(word & 0x7FFFFFFF, expected_parity)

    sdi_map = {0: "ALL", 1: "LEFT", 2: "RIGHT", 3: "CENTER"}
    ssm_map = {
        0: "VERIFIED",
        1: "NO COMPUTED DATA",
        2: "FUNCTIONAL TEST",
        3: "NOT DEFINED",
    }

    active_fault_bits = [b for b in range(11, 29) if (data_19 >> (b - 11)) & 1]
    bite_test_inhibit = bool((data_19 >> (28 - 11)) & 1)
    bit_29_ack = bool((data_19 >> (29 - 11)) & 1)

    return {
        "label": label_oct,
        "raw_hex": f"{word:08X}",
        "sdi_bin": f"{sdi_val:02b}",
        "sdi_name": sdi_map.get(sdi_val, "ALL"),
        "ssm_bin": f"{ssm_val:02b}",
        "ssm_name": ssm_map.get(ssm_val, "VERIFIED"),
        "active_fault_bits": active_fault_bits,
        "bite_test_inhibit": bite_test_inhibit,
        "bit_29_ack": bit_29_ack,
        "parity_ok": (p_bit == expected_p),
    }


# 17 Configuration switches on Label 155 (Aircraft Configuration Word, rate 1000 ms)
CMC_LABEL155_BIT_NAMES: list[tuple[int, str]] = [
    (11, "PRINTER"),
    (12, "LINK"),
    (13, "AIDS"),
    (14, "RMP3"),
    (15, "VHF3"),
    (16, "HF1"),
    (17, "HF2"),
    (18, "ADF2"),
    (19, "MLS1"),
    (20, "MLS2"),
    (21, "WBS1"),
    (22, "RADAR2"),
    (23, "TPIS"),
    (24, "AFT_CRG/HT"),
    (25, "FWD_CRG/HT"),
    (26, "CRG/SMOKE"),
    (27, "WBS2"),
]


def encode_cmc_config_word_155(
    switches: dict[str, bool],
    sdi: str = "00",
    parity: str = "ODD",
) -> int:
    """Encode Aircraft Configuration Word (Label 155, rate 1000 ms).

    Bits 11..27 map to 17 avionics options (1=ON, 0=OFF).
    """
    data_19 = 0
    for bit_idx, name in CMC_LABEL155_BIT_NAMES:
        if switches.get(name, False):
            data_19 |= 1 << (bit_idx - 11)

    label_rev = reverse_label_bits(parse_octal_label("155"))
    sdi_val = parse_sdi(sdi)
    word_31 = (label_rev & 0xFF) | (sdi_val << 8) | (data_19 << 10)
    p_bit = compute_parity_bit(word_31, parity)
    return (word_31 | (p_bit << 31)) & 0xFFFFFFFF


def decode_cmc_config_word_155(raw: int) -> dict[str, bool]:
    """Decode 17 configuration switch states from Label 155."""
    data_19 = (raw >> 10) & 0x7FFFF
    result: dict[str, bool] = {}
    for bit_idx, name in CMC_LABEL155_BIT_NAMES:
        result[name] = bool((data_19 >> (bit_idx - 11)) & 1)
    return result


def encode_cmc_flight_phase_126(
    phase: int,
    sdi: str = "00",
    parity: str = "ODD",
) -> int:
    """Encode Flight Phase (Label 126, rate 1000 ms, numeric value 1-10 BNR on Bit 11-14)."""
    p_val = max(1, min(10, int(phase)))
    data_19 = p_val & 0x0F  # Bits 11..14 (lower 4 bits of 19-bit data field)
    label_rev = reverse_label_bits(parse_octal_label("126"))
    sdi_val = parse_sdi(sdi)
    word_31 = (label_rev & 0xFF) | (sdi_val << 8) | (data_19 << 10)
    p_bit = compute_parity_bit(word_31, parity)
    return (word_31 | (p_bit << 31)) & 0xFFFFFFFF


def decode_cmc_flight_phase_126(raw: int) -> int:
    """Decode Flight Phase numeric value (1-10) from Label 126."""
    data_19 = (raw >> 10) & 0x7FFFF
    return data_19 & 0x0F


def encode_cmc_date_260(
    month: int,
    day: int,
    year: int,
    sdi: str = "00",
    parity: str = "ODD",
) -> int:
    """Encode Date (Label 260, rate 1000 ms, format MM/DD/YY, BCD)."""
    m_tens, m_units = (month // 10) & 0x1, month % 10
    d_tens, d_units = (day // 10) & 0x3, day % 10
    y_tens, y_units = (year // 10) & 0xF, year % 10

    # Pack into 19-bit data field as BCD
    bcd_data = (
        (m_units & 0xF)
        | ((m_tens & 0x1) << 4)
        | ((d_units & 0xF) << 5)
        | ((d_tens & 0x3) << 9)
        | ((y_units & 0xF) << 11)
        | ((y_tens & 0xF) << 15)
    ) & 0x7FFFF

    label_rev = reverse_label_bits(parse_octal_label("260"))
    sdi_val = parse_sdi(sdi)
    word_31 = (label_rev & 0xFF) | (sdi_val << 8) | (bcd_data << 10)
    p_bit = compute_parity_bit(word_31, parity)
    return (word_31 | (p_bit << 31)) & 0xFFFFFFFF


def encode_cmc_time_125(
    hours: int,
    minutes: int,
    tenths: int = 0,
    sdi: str = "00",
    parity: str = "ODD",
) -> int:
    """Encode Time (Label 125, rate 1000 ms, format HH:MM.t GMT, BCD)."""
    h_tens, h_units = (hours // 10) & 0x3, hours % 10
    m_tens, m_units = (minutes // 10) & 0x7, minutes % 10
    t_val = tenths & 0xF

    bcd_data = (
        (t_val & 0xF)
        | ((m_units & 0xF) << 4)
        | ((m_tens & 0x7) << 8)
        | ((h_units & 0xF) << 11)
        | ((h_tens & 0x3) << 15)
    ) & 0x7FFFF

    label_rev = reverse_label_bits(parse_octal_label("125"))
    sdi_val = parse_sdi(sdi)
    word_31 = (label_rev & 0xFF) | (sdi_val << 8) | (bcd_data << 10)
    p_bit = compute_parity_bit(word_31, parity)
    return (word_31 | (p_bit << 31)) & 0xFFFFFFFF


def encode_cmc_iso5_word(
    label_oct: str,
    char1: str,
    char2: str,
    sdi: str = "00",
    parity: str = "ODD",
) -> int:
    """Encode two 7-bit ISO Alphabet #5 characters in specified ARINC word."""
    c1 = ord(char1[0]) & 0x7F if char1 else 0x20
    c2 = ord(char2[0]) & 0x7F if char2 else 0x20
    data_19 = (c1 | (c2 << 7)) & 0x7FFFF

    label_rev = reverse_label_bits(parse_octal_label(label_oct))
    sdi_val = parse_sdi(sdi)
    word_31 = (label_rev & 0xFF) | (sdi_val << 8) | (data_19 << 10)
    p_bit = compute_parity_bit(word_31, parity)
    return (word_31 | (p_bit << 31)) & 0xFFFFFFFF


def encode_cmc_label356_stream(
    lines: list[str],
    include_stx: bool = True,
    include_eot: bool = True,
) -> tuple[list[int], int]:
    """Encode text lines into ordered Label 356 words with STX (0x02) and EOT (0x04).

    Returns (words_list, expected_data_words_count).
    """
    words: list[int] = []
    STX_CHAR = chr(0x02)
    EOT_CHAR = chr(0x04)

    # 1. STX Word (if requested)
    if include_stx:
        words.append(encode_iso5_pair_356(STX_CHAR, " ", seq_ctrl=1))

    # 2. Text words
    full_text = "\n".join(lines)
    padded = full_text if len(full_text) % 2 == 0 else full_text + " "
    seq = 2
    for idx in range(0, len(padded), 2):
        words.append(encode_iso5_pair_356(padded[idx], padded[idx + 1], seq_ctrl=seq))
        seq = (seq + 1) & 0x1F

    expected_count = len(words) - (1 if include_stx else 0)

    # 3. EOT Word (if requested)
    if include_eot:
        words.append(encode_iso5_pair_356(EOT_CHAR, " ", seq_ctrl=seq))

    return words, expected_count


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

