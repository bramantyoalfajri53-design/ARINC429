import pytest
from ate_platform.device.arinc_encode import get_data19, decode_word
from ate_platform.device.arinc_profile import (
    dme_unpack,
    dme_pack,
    encode_label,
    decode_label,
)
from ate_platform.device.label_dict import lookup_label, decode_received
from ate_platform.web.arinc_session import ArincSession


def test_dme_035_decoder_word_unpack():
    # Real measured ARINC 709 words on 134.40 MHz:
    # 0x0D10041D -> DISP=0
    # 0x8D10841D -> DISP=1
    w_disp0 = 0x0D10041D
    w_disp1 = 0x8D10841D

    # Verify get_data19 extracts bit 11..29 correctly without 2-bit shift
    data19_0 = get_data19(w_disp0)
    data19_1 = get_data19(w_disp1)

    unpacked_0 = dme_unpack(data19_0)
    unpacked_1 = dme_unpack(data19_1)

    assert unpacked_0["freq_mhz"] == 134.40
    assert unpacked_0["mode"] == "DF1"
    assert unpacked_0["nav"] == "VOR"
    assert unpacked_0["disp"] is False

    assert unpacked_1["freq_mhz"] == 134.40
    assert unpacked_1["mode"] == "DF1"
    assert unpacked_1["nav"] == "VOR"
    assert unpacked_1["disp"] is True

    # Also test dme_unpack handling 32-bit word directly
    unpacked_direct = dme_unpack(w_disp1)
    assert unpacked_direct["freq_mhz"] == 134.40
    assert unpacked_direct["mode"] == "DF1"
    assert unpacked_direct["disp"] is True


def test_dme_035_round_trip():
    spec = lookup_label("035")
    assert spec is not None

    test_freqs = [134.40, 109.75, 133.70, 114.65, 117.90, 108.00]
    for freq in test_freqs:
        # Encode label 035
        packed = dme_pack(freq, mode="DF1", nav="VOR", disp=True, ident=False)
        unpacked = dme_unpack(packed)
        assert unpacked["freq_mhz"] == freq
        assert unpacked["mode"] == "DF1"
        assert unpacked["disp"] is True


def test_dme_202_mem_and_bf_extraction():
    # Label 202 base word: 50.00 NM
    w202 = 0x61900082
    rec = decode_received(w202)
    assert rec["label_octal"] == "202"
    assert rec["mem"] == "OFF"
    assert rec["bf"] == "B"
    assert rec["eng_value"] == 50.0

    # With MEM bit set (bit 11 in word / bit 10 in 0-indexed)
    w202_mem = w202 | (1 << 10)
    rec_mem = decode_received(w202_mem)
    assert rec_mem["mem"] == "ON"
    assert rec_mem["bf"] == "B"

    # With B/F bit set (bit 12 in word / bit 11 in 0-indexed)
    w202_bf = w202 | (1 << 11)
    rec_bf = decode_received(w202_bf)
    assert rec_bf["mem"] == "OFF"
    assert rec_bf["bf"] == "F"


def test_active_bitrate_and_dme_mode():
    session = ArincSession(card=0, simulation=True)

    # Initial state: default buses
    session.channel["A"].tx_enable = True
    session.channel["A"].rx_enable = True
    session.channel["A"].high_speed = False
    session.channel["B"].tx_enable = True
    session.channel["B"].rx_enable = True
    session.channel["B"].high_speed = False
    session.channel["C"].tx_enable = False
    session.channel["C"].rx_enable = False
    session.channel["C"].high_speed = True
    session.channel["D"].tx_enable = False
    session.channel["D"].rx_enable = False
    session.channel["D"].high_speed = True

    # Active buses A & B are 12.5 kbps (C & D are disabled)
    snap = session.snapshot()
    assert snap["bit_rate_display"] == "12.5 kbps"
    assert snap["bit_rate_kbps"] == 12.5
    assert snap["high_speed"] is False

    # If CH B is set to high speed, display should show dual rate
    session.channel["B"].high_speed = True
    snap = session.snapshot()
    assert snap["bit_rate_display"] == "12.5 / 100 kbps"
    assert snap["high_speed"] is True

    # When DME mode is applied, all channels reset to low speed
    session.apply_dme_mode("single")
    snap = session.snapshot()
    assert snap["bit_rate_display"] == "12.5 kbps"
    assert snap["bit_rate_kbps"] == 12.5
    assert snap["high_speed"] is False
    assert session.channel["C"].tx_enable is False
    assert session.channel["D"].tx_enable is False


def test_dme_echo_frequency_match():
    session = ArincSession(card=0, simulation=True)
    session.apply_dme_mode("single")

    # Set up TX slot 0 on bus A with 134.40 MHz
    session.configure_dme_slot(
        0,
        bus="A",
        freq_mhz=134.40,
        mode="DF1",
        disp=True,
        ident=False,
    )

    # Simulate RX of 134.40 MHz (0x8D10841D)
    session.ingest_rx_word("A", 0x8D10841D)
    echo_res = session.dme_echo("A")
    assert len(echo_res["rows"]) > 0
    assert echo_res["rows"][0]["echo"] == "OK"

    # Simulate RX of different frequency 108.00 MHz (0x0200841D)
    session.ingest_rx_word("A", 0x0200841D)
    echo_err = session.dme_echo("A")
    assert echo_err["rows"][0]["echo"] == "ERR"
