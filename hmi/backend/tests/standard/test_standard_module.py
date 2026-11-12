"""Unit and integration tests for Standard Mode and shared bus transmit."""

from __future__ import annotations

from features.standard import router
from features.standard.schemas import StandardTxSlotModel
from features.standard.service import get_module_metadata, transmit_standard_slot


def test_standard_module_metadata_and_router_prefix():
    meta = get_module_metadata()
    assert meta.mode == "standard"
    assert meta.status == "active"
    assert router.prefix == "/api/standard"


def test_standard_slot_transmit_encodes_and_tags_simulation():
    slot = StandardTxSlotModel(
        slot=1,
        label="270",
        sdi="00",
        data="1234",
        ssm="NO",
        parity="ODD",
        rate=100,
        enabled=True,
    )
    res = transmit_standard_slot("TX-A", slot)
    assert res["ok"] is True
    assert res["mode"] == "STANDARD"
    assert res["source"] == "SIMULATION"
    assert res["label"] == "270"
