"""Unit tests for Standard Mode Dynamic LRU Registry and Single Channel Mode."""

import pytest
from features.standard.lru_registry import LRU_REGISTRY, get_lru_definitions, get_lru_detail
from features.standard.schemas import LruSingleModeTransmitRequest
from features.standard.service import encode_lru_data_and_pad, transmit_lru_single_mode


def test_lru_registry_contains_dme_and_others():
    defs = get_lru_definitions()
    ids = [d["id"] for d in defs]
    assert "DME" in ids
    assert "VOR" in ids
    assert "ILS" in ids
    assert "ADF" in ids
    assert "MMR" in ids

    dme_detail = get_lru_detail("DME")
    assert dme_detail["id"] == "DME"
    assert dme_detail["code"] == "709"
    assert dme_detail["tx_template"]["label"] == "035"
    assert dme_detail["tx_template"]["pad"] == "1100001"
    assert any(f["id"] == "pad" for f in dme_detail["fields"])
    assert any(f["id"] == "data" for f in dme_detail["fields"])


def test_dme_pad_and_data_encoding():
    req = LruSingleModeTransmitRequest(
        lru_id="DME",
        channel="TX-A",
        slot=0,
        label="035",
        function="DME FREQ",
        data="108.00 MHZ",
        sdi="00",
        pad="1100001",
        ssm="NML",
        parity="ODD",
        rate=150,
    )
    payload_19, ssm_str = encode_lru_data_and_pad(req)
    assert ssm_str == "NO"
    # Lower 7 bits should match PAD 1100001 (0x61 = 97)
    assert (payload_19 & 0x7F) == 0b1100001


def test_dme_single_mode_transmit():
    req = LruSingleModeTransmitRequest(
        lru_id="DME",
        channel="TX-A",
        slot=0,
        label="035",
        function="DME FREQ",
        data="108.00 MHZ",
        sdi="00",
        pad="1100001",
        ssm="NML",
        parity="ODD",
        rate=150,
    )
    res = transmit_lru_single_mode(req)
    assert res["lru_id"] == "DME"
    assert res["slot"] == 0
    assert res["channel"] == "TX-A"
    assert len(res["raw_hex"]) == 8
    assert res["ok"] is True
    assert "rx_simulation" in res
    assert res["rx_simulation"]["label"] == "202"
    assert res["rx_simulation"]["function"] == "DME DIST"


def test_custom_pad_and_data_modification():
    req = LruSingleModeTransmitRequest(
        lru_id="DME",
        channel="TX-B",
        slot=0,
        label="035",
        function="DME FREQ",
        data="115.50 MHZ",
        sdi="01",
        pad="0100001",  # Changed PAD
        ssm="FT",       # Functional Test
        parity="ODD",
        rate=100,
    )
    res = transmit_lru_single_mode(req)
    assert res["channel"] == "TX-B"
    assert res["pad"] == "0100001"
    assert res["data_eng"] == "115.50 MHZ"
    payload_19, ssm_str = encode_lru_data_and_pad(req)
    assert (payload_19 & 0x7F) == 0b0100001
    assert ssm_str == "FT"


def test_vor_single_mode_transmit():
    req = LruSingleModeTransmitRequest(
        lru_id="VOR",
        channel="TX-A",
        slot=0,
        label="034",
        function="VOR FREQ",
        data="112.50 MHZ",
        sdi="00",
        pad="0000",
        ssm="NML",
        parity="ODD",
        rate=200,
    )
    res = transmit_lru_single_mode(req)
    assert res["lru_id"] == "VOR"
    assert res["channel"] == "TX-A"
    assert res["pad"] == "0000"
    assert res["rx_simulation"]["label"] == "000"


def test_dme_dynapro_modes_navigation_and_slots():
    from ate_platform.web.arinc_session import ArincSession

    sess = ArincSession()
    # Test Single mode
    s_single = sess.apply_dme_mode("single")
    assert s_single["dme"]["mode"] == "single"
    assert s_single["screen_stack"][-1] == "dme_single"
    assert sess.tx["A"][0].enabled is True

    # Test Multi mode
    s_multi = sess.apply_dme_mode("multi")
    assert s_multi["dme"]["mode"] == "multi"
    assert s_multi["screen_stack"][-1] == "dme_multi"
    for i in range(5):
        assert sess.tx["A"][i].enabled is True

    # Test Standard Nav mode
    s_std = sess.apply_dme_mode("standard")
    assert s_std["dme"]["mode"] == "standard"
    assert s_std["screen_stack"][-1] == "dme_standard"

    # Test editing parameters on slot 0
    res_slot = sess.configure_dme_slot(
        0,
        bus="A",
        freq_mhz=108.50,
        pad="0100001",
        sdi=2,
        ssm="NML",
        parity="EVEN",
        rate_ms=150,
    )
    sl = sess.tx["A"][0]
    assert sl.parity == "EVEN"
    assert sl.rate_ms == 150
    assert sl.sdi == 2
    assert sl.eng_value == 108.50

