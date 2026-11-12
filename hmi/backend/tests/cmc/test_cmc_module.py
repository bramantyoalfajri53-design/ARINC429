"""Unit and integration tests for Boeing CMC Mode (Label 227, 350, 351, 356)."""

from __future__ import annotations

from features.cmc import router
from features.cmc.schemas import CmcConfigDataRequest, CmcShopFaultsRequest
from features.cmc.service import (
    get_module_metadata,
    request_cmc_config_data,
    request_cmc_shop_faults,
    update_cmc_fault_bit,
)


def test_cmc_module_metadata_and_router_prefix():
    meta = get_module_metadata()
    assert meta.mode == "cmc"
    assert meta.status == "active"
    assert router.prefix == "/api/cmc"


def test_cmc_fault_summary_bits_and_bit29_ack():
    st = update_cmc_fault_bit(bit=12, fault=True, command_ack=False)
    assert st["fault_summary"]["bit_29_ack"] is False
    assert 12 in st["fault_summary"]["word_350"]["active_fault_bits"]

    st2 = update_cmc_fault_bit(bit=12, fault=False, command_ack=True)
    assert st2["fault_summary"]["bit_29_ack"] is True
    assert 12 not in st2["fault_summary"]["word_350"]["active_fault_bits"]


def test_cmc_config_data_manual_error_messages():
    no_ack = request_cmc_config_data(CmcConfigDataRequest(simulate_mode="NO_ACK"))
    assert no_ack["config_data"]["valid"] is False
    assert no_ack["config_data"]["message"] == "NO COMMAND WORD ACK RCVD"

    no_maint = request_cmc_config_data(CmcConfigDataRequest(simulate_mode="NO_MAINTENANCE_DATA"))
    assert no_maint["config_data"]["valid"] is False
    assert no_maint["config_data"]["message"] == "NO MAINTENANCE DATA RECEIVED"

    timeout = request_cmc_config_data(CmcConfigDataRequest(simulate_mode="TIMEOUT_12S"))
    assert timeout["config_data"]["valid"] is False
    assert timeout["config_data"]["message"] == "NO LRU RESPONSE IN 12 SECS"


def test_cmc_config_data_and_shop_faults_ordered_words_in_simulation():
    ok_cfg = request_cmc_config_data(CmcConfigDataRequest(simulate_mode="SUCCESS"))
    assert ok_cfg["config_data"]["source"] == "SIMULATION"
    assert ok_cfg["config_data"]["valid"] is True
    assert ok_cfg["config_data"]["part_number"] == "4059000-902"

    ok_shop = request_cmc_shop_faults(CmcShopFaultsRequest(simulate_mode="SUCCESS"))
    assert ok_shop["shop_faults"]["source"] == "SIMULATION"
    assert ok_shop["shop_faults"]["valid"] is True
    ordered = ok_shop["shop_faults"]["ordered_words"]
    assert len(ordered) > 0
    assert [w["word_order"] for w in ordered] == list(range(1, len(ordered) + 1))
