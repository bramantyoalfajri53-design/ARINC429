import pytest
from ate_platform.device.arinc_encode import (
    encode_dme_frequency_035,
    decode_dme_frequency_035,
    decode_dme_distance_202,
    decode_dme_distance_201,
)
from ate_platform.device.label_dict import decode_received
from ate_platform.web.arinc_session import ArincSession


def test_tx_035_bit_packing_matches_t1200b_hardware():
    """Verify bit-packing for Label 035 matching JcAIR T1200B physical signal."""
    # Parameters matching T1200B TX: 134.40 MHz, DF1, VOR, DISP ON, IDENT OFF, SDI 00, SSM 00, Odd Parity
    w = encode_dme_frequency_035(
        freq_mhz=134.40,
        mode="DF1",
        sdi=0,
        disp=True,
        ident=False,
        nav="VOR",
        ssm=0,
        odd_parity=True,
    )
    assert w == 0x8D10841D, f"Expected 0x8D10841D, got 0x{w:08X}"

    # Decode it back and verify fields
    d = decode_dme_frequency_035(w)
    assert d["freq_mhz"] == 134.40
    assert d["mode"] == "DF1"
    assert d["nav"] == "VOR"
    assert d["disp"] is True
    assert d["ident"] is False
    assert d["sdi"] == 0
    assert d["ssm"] == 0
    assert d["parity_odd"] is True


def test_rx_202_bnr_distance_scale_matches_atc1400a():
    """Verify 0x61900082 decodes to exactly 50.00 NM per ARINC 709 & ATC-1400A."""
    word = 0x61900082
    d = decode_dme_distance_202(word)
    assert d["label_octal"] == "202"
    assert d["dist_nm"] == 50.00
    assert d["dist_text"] == "50.00 NM"
    assert d["mem"] == "OFF"
    assert d["bf"] == "B"
    assert d["ssm_name"] == "NML"
    assert d["parity_odd"] is True

    # Test via decode_received (as used by session)
    rec = decode_received(word)
    assert rec["label_octal"] == "202"
    assert rec["eng_value"] == 50.00
    assert "50.00" in rec["data_text"]
    assert rec["mem"] == "OFF"
    assert rec["bf"] == "B"


def test_rx_201_bcd_distance():
    """Verify Label 201 BCD distance decoding."""
    # 50.00 NM in BCD (hundredths of NM: 5000 = 0x05000 in bits 11-29)
    w201 = 0x81 | ((0x05000 & 0x7FFFF) << 10)
    num_ones = bin(w201).count('1')
    if num_ones % 2 == 0:
        w201 |= (1 << 31)

    d201 = decode_dme_distance_201(w201)
    assert d201["label_octal"] == "201"
    assert d201["dist_nm"] == 50.00
    assert d201["dist_text"] == "50.00 NM"
    assert d201["ssm_name"] == "NML"
    assert d201["parity_odd"] is True


def test_session_dme_filters_and_selftest_reconfig():
    """Verify session accepts 201 in DME mode and reconfigures post-selftest."""
    sess = ArincSession(card=0, simulation=True)
    sess.apply_profile("dme")
    sess.set_mode("standard")

    # Ingest 201, 202, 035
    w201 = 0x81 | ((0x05000 & 0x7FFFF) << 10)
    if bin(w201).count('1') % 2 == 0:
        w201 |= (1 << 31)

    hit = sess.ingest_rx_word("A", w201)
    assert hit is not None, "Label 201 should be accepted in DME mode"
    assert hit.label_octal == "201"

    # Hardware selftest sets _force_reconfig
    res = sess.hardware_selftest()
    assert res["overall_status"] == "PASS"
    assert getattr(sess, "_force_reconfig", False) is True

    # Activity monitor returns both hits/count and age_s/last_seen_s
    act = sess.get_channel_activity()
    ch0 = next(c for c in act if c["channel"] == 0)
    assert "hits" in ch0
    assert "count" in ch0
    assert "age_s" in ch0
    assert "last_seen_s" in ch0


def test_dme_diagnostic_simulation_values():
    """Verify DME diagnostic simulated scenario uses correct 50.00 NM words."""
    sess = ArincSession(card=0, simulation=True)
    diag = sess.dme_handshake_diagnostic(bus="A", freq_mhz=134.40)
    assert diag["status_code"] == "CONNECTED_ACTIVE"
    assert diag["echo"]["status"] == "ECHO OK"
    assert diag["bnr_distance"]["dist_nm"] == 50.00
    assert diag["bnr_distance"]["dist_text"] == "50.00 NM"
    assert diag["ident"]["ident_text"] != "PRES"
