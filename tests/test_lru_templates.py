"""Every T1200 LRU template has encoding, units, and a round-trip default."""

from __future__ import annotations

import pytest

btidriver = pytest.importorskip("btidriver")

from ate_platform.device.arinc_profile import CATALOG, decode_label, encode_label, load_profile
from ate_platform.web.arinc_session import ArincSession

NEED_UNITS = {"raw", "bcd", "bcd_freq_khz", "bcd_tenths_khz", "bnr", "dme_freq", "hf_pair", "iso5"}

def test_catalog_order_matches_figure_14():
    assert [c["id"] for c in CATALOG] == [
        "adf_032", "vor", "ils", "dme", "atc_xpdr", "radio_alt", "vhf_comm",
        "hf_719", "hfdu_753", "vdr_750", "hfdr_753", "hf_rmp", "hf_acars",
        "hfdu_rmp", "hfdr_rmp", "vhf_833", "mmr_755", "vhf_align", "vdl_mode", "vor_579",
    ]


@pytest.mark.parametrize("pid", [c["id"] for c in CATALOG])
def test_catalog_template_fields(pid):
    p = load_profile(pid)
    assert p.labels, f"{pid} has no labels"
    for ls in p.labels:
        assert ls.label_octal and ls.label_octal != "000"
        assert ls.funct, f"{pid} L{ls.label_octal} missing funct"
        assert ls.encoding in NEED_UNITS, f"{pid} L{ls.label_octal} encoding={ls.encoding}"
        assert ls.units, f"{pid} L{ls.label_octal} missing units"
        assert ls.ssm
        assert ls.parity == "ODD"
        assert ls.rate_ms >= 10


@pytest.mark.parametrize("pid", [c["id"] for c in CATALOG])
def test_catalog_tx_default_roundtrip(pid):
    p = load_profile(pid)
    tx = [ls for ls in p.labels if ls.direction in ("tx", "both", "")]
    assert tx, f"{pid} has no TX labels"
    spec = tx[0]
    default = spec.eng_default if spec.eng_default is not None else 0
    word = encode_label(spec, default)
    dec = decode_label(spec, word)
    text = (dec.get("data_text") or "").upper()
    if spec.encoding == "iso5":
        assert str(default).upper() in text or text
    elif spec.encoding == "raw":
        assert text
    else:
        assert spec.units.upper() in text, f"{pid} {spec.label_octal} text={dec.get('data_text')!r}"


def test_apply_profile_persists_units_and_format():
    sess = ArincSession()
    snap = sess.apply_profile("adf_032")
    slot = snap["tx"]["A"][0]
    assert slot["label"] == "032"
    assert slot["units"] == "KHZ"
    assert slot["encoding"] == "bcd_freq_khz"
    assert "577.0" in (slot["data_eng"] or slot["data"])
    labels = {x["label"]: x for x in snap["profile"]["labels"]}
    assert labels["032"]["units"] == "KHZ"
    assert labels["032"]["par"] == "ODD"
    assert labels["162"]["direction"] == "rx"
    assert labels["162"]["units"] == "DEG"
    rx = {x["label"]: x for x in snap["rx"]["A"]["labels"]}
    assert rx["162"]["units"] == "DEG"

    snap = sess.apply_profile("vhf_comm")
    slot = snap["tx"]["A"][0]
    assert slot["label"] == "030"
    assert slot["units"] == "MHZ"
    assert "118" in (slot["data_eng"] or slot["data"])
    rx = {x["label"] for x in snap["rx"]["A"]["labels"]}
    assert rx == {"030"}

    snap = sess.apply_profile("radio_alt")
    by_lab = {s["label"]: s for s in snap["tx"]["A"] if s["enabled"]}
    assert by_lab["165"]["units"] == "FT"
    assert "1000.0" in (by_lab["165"]["data_eng"] or by_lab["165"]["data"])
def test_rx_list_follows_active_lru_template():
    sess = ArincSession()
    sess.apply_profile("adf_032")
    sess.apply_profile("vor")
    sess.apply_profile("ils")
    snap = sess.apply_profile("vhf_comm")
    rx = {x["label"] for x in snap["rx"]["A"]["labels"]}
    assert rx == {"030"}, rx
    assert snap["rx"]["A"]["filter_labels"] == ["030"]

    snap = sess.apply_profile("vor")
    rx = {x["label"] for x in snap["rx"]["A"]["labels"]}
    assert "222" in rx and "034" in rx
    assert "030" not in rx and "162" not in rx and "173" not in rx

    snap = sess.apply_profile("ils")
    rx = {x["label"] for x in snap["rx"]["A"]["labels"]}
    assert rx == {"033", "017", "357", "105", "173", "174"}, rx

    snap = sess.apply_dme_mode("single")
    rx = {x["label"] for x in snap["rx"]["A"]["labels"]}
    assert rx == {"035", "202", "246", "247"}, rx
    assert "033" not in rx

    snap = sess.apply_profile("hf_719", rx_ch="A")
    rx = {x["label"] for x in snap["rx"]["A"]["labels"]}
    assert rx == {"037"}, rx
    assert snap["tx"]["A"][0]["label"] == "037"


def test_foreign_label_not_ingested_while_vhf_active():
    from ate_platform.device.arinc_encode import encode_adf_freq_032
    from ate_platform.device.arinc_profile import encode_label, load_profile
    sess = ArincSession()
    sess.apply_profile("vhf_comm")
    sess.ingest_rx_word("A", encode_adf_freq_032(577.0))
    rx = {x["label"] for x in sess.snapshot()["rx"]["A"]["labels"]}
    assert "032" not in rx
    vhf = load_profile("vhf_comm").labels[0]
    sess.ingest_rx_word("A", encode_label(vhf, 118.0))
    labs = {x["label"]: x for x in sess.snapshot()["rx"]["A"]["labels"]}
    assert labs["030"]["hits"] >= 1
    assert "MHZ" in (labs["030"]["data"] or "").upper() or labs["030"]["units"] == "MHZ"


def test_apply_profile_split_tx_rx_ch():
    sess = ArincSession()
    snap = sess.apply_profile("vhf_comm", tx_ch="A", rx_ch="B")
    assert snap["tx_ch"] == "A"
    assert snap["rx_ch"] == "B"
    assert snap["tx"]["A"][0]["label"] == "030"
    assert {x["label"] for x in snap["rx"]["B"]["labels"]} == {"030"}
    assert not snap["rx"]["A"]["labels"]
    snap = sess.apply_profile("adf_032", tx_ch="B", rx_ch="C")
    assert snap["tx"]["A"][0]["label"] == "030"
    assert snap["tx"]["B"][0]["label"] == "032"
    assert {x["label"] for x in snap["rx"]["C"]["labels"]} == {"032", "162"}
    assert {x["label"] for x in snap["rx"]["B"]["labels"]} == {"030"}
    p = load_profile("vhf_comm")
    assert p.tx_ch == "A" and p.rx_ch == "A"
