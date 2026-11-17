"""Encode/decode tests for ARINC words (needs btidriver)."""

from __future__ import annotations

import pytest

btidriver = pytest.importorskip("btidriver")

from ate_platform.device.arinc_encode import (
    decode_adf_freq_032,
    decode_word,
    encode_adf_freq_032,
    encode_raw_word,
    join_pad,
    parse_label,
    split_pad,
)


def test_adf_032_roundtrip_577():
    word = encode_adf_freq_032(577.0, sdi=0, ssm="NML")
    decoded = decode_adf_freq_032(word)
    assert decoded.label == 0o032
    assert decoded.engineering["freq_khz"] == pytest.approx(577.0)
    assert decoded.data_text == "577.0 KHZ"
    assert decoded.ssm_name == "NML"
    assert decoded.funct == "ADF"
    assert decoded.pad3 == decoded.data19 & 0x7


def test_raw_word_fields():
    word = encode_raw_word("201", "12345", sdi=1, ssm="NML", odd_parity=True)
    d = decode_word(word, profile="none")
    assert d.label == 0o201
    assert d.sdi == 1
    assert d.data19 == 0x12345
    assert d.ssm_name == "NML"
    assert d.pad3 == 0x12345 & 0x7
    assert d.data16 == 0x12345 >> 3


def test_parse_label_octal():
    assert parse_label("032") == 0o032
    assert parse_label(0o201) == 0o201


def test_pad_split_join():
    assert split_pad(0x12345) == (0x5, 0x2468)
    assert join_pad(0x5, 0x2468) == 0x12345
    assert join_pad(0, 0) == 0


def test_parity_is_odd_even_of_whole_word_not_bit32():
    """TX ODD must decode as ODD even when bit 32 is 0 (e.g. PRES ALT 350 FT)."""
    from ate_platform.device.arinc_encode import decode_word, encode_raw_word, word_parity_odd
    from ate_platform.device.arinc_profile import encode_label
    from ate_platform.device.label_dict import decode_received, lookup_label

    spec = lookup_label("203")
    word = encode_label(spec, 350.0)
    assert word_parity_odd(word) is True
    assert decode_word(word, profile="none").parity_odd is True
    assert decode_received(word)["parity_odd"] is True
    even = encode_raw_word("203", 0, odd_parity=False)
    assert word_parity_odd(even) is False
    assert decode_word(even, profile="none").parity_odd is False


def test_ssm_nml_is_not_six():
    """T1200 NML is ARINC bits 30-31 = 11. BNRGetSSM includes bit 29 and reads 6."""
    from btidriver import bti429
    from ate_platform.device.arinc_encode import decode_word, get_ssm_bits, put_ssm_bits
    from ate_platform.device.arinc_profile import encode_label
    from ate_platform.device.label_dict import decode_received, lookup_label

    spec = lookup_label("203")
    word = encode_label(spec, 350.0)
    assert get_ssm_bits(word) == 3
    assert decode_received(word)["ssm_name"] == "NML"
    assert decode_received(word)["pads"] == "0"
    # Simulate T1200 word: data from our encode, SSM already 11
    t1200 = put_ssm_bits(word, 3)
    rec = decode_received(t1200)
    assert rec["ssm_name"] == "NML"
    assert rec["ssm_name"] != "6"
    assert bti429.BNRGetSSM(t1200) == 6
    assert decode_word(t1200, profile="none").ssm_name == "NML"
    vhf = lookup_label("030")
    w030 = encode_label(vhf, 118.0)
    assert get_ssm_bits(w030) == 0  # T1200 BCD NML = Plus (00), not 11
    assert decode_received(w030)["ssm_name"] == "NML"
    assert decode_received(w030)["ssm_name"] != "PLS"
    assert decode_received(w030)["pads"] == "-"
    w047 = encode_label(lookup_label("047"), 117.992)
    assert get_ssm_bits(w047) == 0
    assert decode_received(w047)["ssm_name"] == "NML"


def test_library_ssm_matches_template_on_tx_rx():
    """Every library label: TX default SSM decodes to the same name (no NML→PLS etc.)."""
    from ate_platform.device.arinc_profile import encode_label
    from ate_platform.device.label_dict import decode_received, label_dictionary

    bad = []
    for octal, spec in sorted(label_dictionary().items()):
        val = spec.eng_default
        if val is None:
            val = 0
        try:
            word = encode_label(spec, val)
        except Exception:
            continue
        got = decode_received(word)["ssm_name"]
        want = (spec.ssm or "NML").upper()
        if got != want:
            bad.append((octal, spec.encoding, want, got))
    assert not bad, bad


def test_vhf_lra_roundtrip():
    from ate_platform.device.arinc_profile import decode_label, encode_label, load_profile
    vhf = load_profile("vhf_comm").labels[0]
    word = encode_label(vhf, 118.0)
    assert "118.000" in decode_label(vhf, word)["data_text"]
    lra = load_profile("radio_alt").labels[0]
    word = encode_label(lra, 1000.0)
    assert "1000.0" in decode_label(lra, word)["data_text"]


def test_hf_037_25mhz_is_not_12_8():
    """T1200 HF BCD starts at bit 12 (bit 11 = SB). Bit-11 packing made 25 MHz read 12.8."""
    from dataclasses import replace

    from btidriver import bti429
    from ate_platform.device.arinc_encode import word_parity_odd
    from ate_platform.device.arinc_profile import (
        decode_label,
        encode_label,
        hf_get_freq_bcd,
        sched_period_ms,
    )
    from ate_platform.device.label_dict import lookup_label

    spec = lookup_label("037")
    word = encode_label(spec, 25.0)
    rec = decode_label(spec, word)
    assert rec["eng_value"] == 25.0
    mant, sb = hf_get_freq_bcd(word)
    assert mant == 25000
    assert sb == 0
    # Naive Ballard BCD (bit 11) must not be what T1200 shows
    naive = int(bti429.BCDGetMant(word, 5))
    assert naive != 12800
    # T1200 view: BCD in bits 12–31
    tmp = (word & 0x3FF) | (((word >> 11) & 0xFFFFF) << 10)
    assert int(bti429.BCDGetMant(tmp, 5)) == 25000

    even = encode_label(replace(spec, parity="EVEN"), 25.0)
    assert word_parity_odd(word) is True
    assert word_parity_odd(even) is False
    assert sched_period_ms(200) == (200, 200)


def test_atc_031_squawk_not_half():
    """T1200 031 is 4×3-bit octal in bits 18–29. FldPutData started at bit 9 (SDI)."""
    from btidriver import bti429
    from ate_platform.device.arinc_profile import decode_label, encode_label, squawk_unpack
    from ate_platform.device.arinc_encode import get_data19
    from ate_platform.device.label_dict import lookup_label

    spec = lookup_label("031")

    def t1200_octal(word: int) -> int:
        n = 0
        for i in range(4):
            v = 0
            for b in range(3):
                v |= ((word >> (18 - 1 + i * 3 + b)) & 1) << b
            n += v * (10 ** i)
        return n

    for code in (200, 150, 500, 1234, 52, 120, 7777):
        word = encode_label(spec, code)
        rec = decode_label(spec, word)
        assert int(rec["eng_value"]) == code, (code, rec)
        assert t1200_octal(word) == code, (code, t1200_octal(word), hex(word))
        assert bti429.FldGetSDI(word) == (spec.sdi & 0x3)
        assert squawk_unpack(get_data19(word)) == code
    w500 = encode_label(spec, 500)
    assert t1200_octal(w500) != 120


def test_tx_150ms_period_bits_not_1_5x():
    from ate_platform.web.arinc_session import tx_frame_ms, tx_period_bits

    assert tx_frame_ms([150]) == 150
    bits = tx_period_bits(150, 12.5)
    assert bits == 1875  # 150 ms at 12.5 kbps (80 µs/bit)
    assert bits * 80 / 1000 == 150
