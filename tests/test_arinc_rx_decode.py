"""RX engineering decode via the shared label dictionary (needs btidriver)."""

from __future__ import annotations

import time

import pytest

btidriver = pytest.importorskip("btidriver")

from ate_platform.device.arinc_encode import encode_adf_freq_032
from ate_platform.device.arinc_profile import decode_label, encode_label, load_profile
from ate_platform.device.label_dict import decode_received, lookup_label
from ate_platform.web.arinc_session import ArincSession


def test_lookup_adf_032():
    spec = lookup_label("032")
    assert spec is not None
    assert spec.funct == "ADF FREQ"
    assert spec.units == "KHZ"


def test_decode_received_adf_khz():
    word = encode_adf_freq_032(577.0)
    rec = decode_received(word, display_mode="ENG")
    assert rec["label_octal"] == "032"
    assert rec["data_text"] == "577.0 KHZ"
    assert rec["eng_value"] == pytest.approx(577.0)
    assert rec["units"] == "KHZ"


def test_decode_received_vhf_mhz():
    spec = load_profile("vhf_comm").labels[0]
    word = encode_label(spec, 118.0)
    rec = decode_received(word, display_mode="ENG")
    assert rec["label_octal"] == "030"
    assert "118" in rec["data_text"]
    assert rec["units"] == "MHZ"


def _t1200_bcd_word(label_oct: int, mantissa: int, digits: int = 5) -> int:
    from btidriver import bti429
    w = bti429.FldPutLabel(0, label_oct)
    w = bti429.BCDPutMant(w, mantissa, digits, 0)
    w = bti429.BCDPutSSM(w, 0)
    return int(w) & 0xFFFFFFFF


def test_t1200_vhf_030_118mhz_not_60():
    """T1200 TX of 118.000 MHz uses 5 BCD digits of 118000 (overflow → 60 if read as 6 digits)."""
    spec = lookup_label("030")
    assert spec is not None
    overflow = _t1200_bcd_word(0o030, 118000, 5)
    rec = decode_label(spec, overflow)
    assert rec["eng_value"] == pytest.approx(118.0)
    assert "118.000" in rec["data_text"]
    hundredths = _t1200_bcd_word(0o030, 11800, 5)
    rec2 = decode_label(spec, hundredths)
    assert rec2["eng_value"] == pytest.approx(118.0)
    our = encode_label(spec, 118.0)
    assert "118.000" in decode_label(spec, our)["data_text"]
    eight = lookup_label("047")
    assert eight is not None
    rec833 = decode_label(eight, _t1200_bcd_word(0o047, 117992, 5))
    assert rec833["eng_value"] == pytest.approx(117.992)


def test_rx_rate_ms_from_library_and_period():
    sess = ArincSession()
    sess.channel["A"].display_mode = "ENG"
    sess.channel["A"].rx_enable = True
    sess.rx["A"].enabled = True
    spec = lookup_label("030")
    word = encode_label(spec, 118.0)
    t0 = 1_700_000_000.0
    sess.ingest_rx_word("A", word, ts=t0)
    first = {row["label"]: row for row in sess.snapshot()["rx"]["A"]["labels"]}
    assert first["030"]["rate_ms"] == 150
    sess.ingest_rx_word("A", word, ts=t0 + 0.150)
    second = {row["label"]: row for row in sess.snapshot()["rx"]["A"]["labels"]}
    assert second["030"]["rate_ms"] == 150
    assert "118" in second["030"]["data"]


def test_t1200_pres_alt_203_350ft_not_2800():
    """T1200 TX 350 FT uses BNR sigbits from PADS (17), not FldPutData (350<<3 = 2800)."""
    from btidriver import bti429
    spec = lookup_label("203")
    assert spec is not None
    assert spec.encoding == "bnr"
    assert spec.bnr_bits == 17
    t1200 = bti429.FldPutLabel(0, 0o203)
    t1200 = bti429.BNRPutValue(350.0, t1200, 17, 1.0)
    t1200 = bti429.BNRPutSSM(t1200, 0)
    rec = decode_label(spec, t1200)
    assert rec["eng_value"] == pytest.approx(350.0)
    assert "350" in rec["data_text"]
    our = encode_label(spec, 350.0)
    rec2 = decode_label(spec, our)
    assert rec2["eng_value"] == pytest.approx(350.0)
    # Console TX must match T1200 packing so T1200 RX also reads 350.
    assert bti429.BNRGetValue(our, 17, 1.0) == pytest.approx(350.0)
    assert (bti429.FldGetData(t1200) & 0x7FFFF) == pytest.approx(2800)


def test_bnr_radio_alt_and_vor_roundtrip():
    lra = load_profile("radio_alt")
    spec164 = next(ls for ls in lra.labels if ls.label_octal == "164")
    rec = decode_label(spec164, encode_label(spec164, 125.0))
    assert rec["eng_value"] == pytest.approx(125.0)
    vor = load_profile("vor")
    spec222 = next(ls for ls in vor.labels if ls.label_octal == "222")
    rec = decode_label(spec222, encode_label(spec222, 90.0))
    assert rec["eng_value"] == pytest.approx(90.0, abs=0.1)
    spec = load_profile("radio_alt").labels[0]
    word = encode_label(spec, 1000.0)
    rec = decode_received(word, display_mode="ENG")
    assert rec["label_octal"] == "165"
    assert "1000.0" in rec["data_text"]
    assert rec["units"] == "FT"


def test_session_ingest_per_label_list():
    sess = ArincSession()
    sess.channel["A"].display_mode = "ENG"
    sess.channel["A"].rx_enable = True
    sess.rx["A"].enabled = True
    word = encode_adf_freq_032(577.0)
    hit = sess.ingest_rx_word("A", word)
    assert hit is not None
    assert hit.data_text == "577.0 KHZ"
    snap = sess.snapshot()
    labs = snap["rx"]["A"]["labels"]
    assert labs[0]["label"] == "032"
    assert labs[0]["data"] == "577.0 KHZ"
    assert labs[0]["units"] == "KHZ"


def test_snapshot_holds_rx_after_stop():
    sess = ArincSession()
    sess.channel["B"].display_mode = "ENG"
    sess.channel["B"].rx_enable = True
    sess.rx["B"].enabled = True
    word = encode_adf_freq_032(577.0)
    assert sess.ingest_rx_word("B", word) is not None
    sess._running = False
    held = {row["label"]: row for row in sess.snapshot()["rx"]["B"]["labels"]}
    assert held["032"]["data"] == "577.0 KHZ"
    sess.rx["B"].by_label["032"].ts = time.time() - 10.0
    sess._running = True
    live = {row["label"]: row for row in sess.snapshot()["rx"]["B"]["labels"]}
    assert "032" not in live


def test_cross_channel_rx_tables_stay_independent():
    sess = ArincSession()
    for bus in ("A", "B"):
        sess.channel[bus].display_mode = "ENG"
        sess.channel[bus].rx_enable = True
        sess.rx[bus].enabled = True
    vhf = load_profile("vhf_comm").labels[0]
    sess.ingest_rx_word("B", encode_label(vhf, 118.0))
    sess.ingest_rx_word("A", encode_adf_freq_032(577.0))
    snap = sess.snapshot()
    a = {row["label"]: row for row in snap["rx"]["A"]["labels"]}
    b = {row["label"]: row for row in snap["rx"]["B"]["labels"]}
    assert a["032"]["data"] == "577.0 KHZ"
    assert "118" in b["030"]["data"]
    assert "030" not in a
    assert "032" not in b


def test_rx_defaults_to_auto():
    sess = ArincSession()
    snap = sess.snapshot()
    assert snap["rx_profile"]["A"] == "auto"
    assert snap["rx"]["A"]["auto"] is True
    assert snap["rx"]["A"]["groups"] == []


def test_rx_auto_is_flat_library_rows():
    sess = ArincSession()
    sess.channel["A"].display_mode = "ENG"
    sess.channel["A"].rx_enable = True
    sess.rx["A"].enabled = True
    ils = load_profile("ils")
    spec033 = ils.find_label("033")
    spec357 = ils.find_label("357")
    assert spec033 is not None and spec357 is not None
    sess.ingest_rx_word("A", encode_label(spec033, 110.30))
    sess.ingest_rx_word("A", encode_label(spec357, "KQE"))
    snap = sess.snapshot()
    assert snap["rx"]["A"]["auto"] is True
    assert snap["rx"]["A"]["groups"] == []
    by_lab = {row["label"]: row for row in snap["rx"]["A"]["labels"]}
    assert set(by_lab) == {"033", "357"}
    assert by_lab["033"]["units"] == "MHZ"
    assert "KQE" in (by_lab["357"]["data"] or "")


def test_rx_auto_hides_stale_labels():
    sess = ArincSession()
    sess._running = True
    sess.channel["A"].display_mode = "ENG"
    sess.channel["A"].rx_enable = True
    sess.rx["A"].enabled = True
    ils = load_profile("ils")
    spec033 = ils.find_label("033")
    spec357 = ils.find_label("357")
    sess.ingest_rx_word("A", encode_label(spec033, 110.30))
    sess.ingest_rx_word("A", encode_label(spec357, "KQE"))
    sess.rx["A"].by_label["033"].ts = time.time() - 10.0
    by_lab = {row["label"]: row for row in sess.snapshot()["rx"]["A"]["labels"]}
    assert set(by_lab) == {"357"}


def test_rx_auto_clears_manual_filter():
    sess = ArincSession()
    sess.apply_profile("vhf_comm", tx_ch="A", rx_ch="A", apply_tx=False, apply_rx=True)
    assert sess.rx["A"].filter_labels == ["030"]
    assert sess.snapshot()["rx_profile"]["A"] == "vhf_comm"
    snap = sess.apply_profile("auto", rx_ch="A", apply_tx=False, apply_rx=True)
    assert sess.rx["A"].filter_labels == []
    assert snap["rx_profile"]["A"] == "auto"
    assert snap["rx"]["A"]["auto"] is True


def test_vor_ils_atc_defaults():
    vor = load_profile("vor")
    tx = [ls.label_octal for ls in vor.labels if ls.direction != "rx"]
    assert tx == ["034", "024", "027", "100", "110"]
    assert any(ls.label_octal == "222" and ls.units == "DEG" for ls in vor.labels)
    ils = load_profile("ils")
    tx = [ls.label_octal for ls in ils.labels if ls.direction != "rx"]
    assert tx == ["033", "017", "357", "105"]
    word = encode_label(ils.labels[2], "KQE")
    assert decode_label(ils.labels[2], word)["data_text"] == "KQE"
    atc = load_profile("atc_xpdr")
    word = encode_label(atc.labels[0], 1234)
    assert "1234" in decode_label(atc.labels[0], word)["data_text"]


def test_dme_and_mmr_session():
    sess = ArincSession()
    snap = sess.apply_dme_mode("single")
    assert snap["dme"]["mode"] == "single"
    assert snap["tx"]["A"][0]["label"] == "035"
    snap = sess.set_mmr_menu("ils")
    assert snap["mmr_menu"] == "ils"
    bg = [s["label"] for s in snap["tx"]["B"] if s["enabled"]]
    assert "125" in bg and "040" in bg


def test_tx_slot_hf_parity_rate_and_25mhz():
    from ate_platform.device.arinc_encode import word_parity_odd

    sess = ArincSession()
    sl = sess.configure_tx_slot(
        "A", 0,
        mode="lru", profile="hf_719", label="037",
        eng_value=25.0, rate_ms=200, odd_parity=False, enabled=True,
    )
    assert sl.label_octal == "037"
    assert sl.rate_ms == 200
    assert sl.parity == "EVEN"
    assert word_parity_odd(sl.raw) is False
    rec = decode_label(lookup_label("037"), sl.raw)
    assert rec["eng_value"] == 25.0
