"""Unit and integration tests for Boeing CMC Mode (Aeroflex T1200B / D243W201-1 / ARINC 604-1)."""

from __future__ import annotations

from core.arinc429 import (
    decode_cmc_command_227,
    decode_cmc_config_word_155,
    decode_cmc_fault_summary_word,
    decode_cmc_flight_phase_126,
    encode_cmc_command_227,
    encode_cmc_config_word_155,
    encode_cmc_fault_summary_word,
    encode_cmc_flight_phase_126,
)
from features.cmc import router
from features.cmc.schemas import (
    CmcCommandSummaryRequest,
    CmcConfigDataRequest,
    CmcLruSelectRequest,
    CmcShopFaultsRequest,
    CmcTerminalActionRequest,
    CmcTransmitDataRequest,
)
from features.cmc.service import (
    get_cmc_state,
    get_module_metadata,
    handle_cmc_terminal_action,
    request_cmc_config_data,
    request_cmc_shop_faults,
    select_cmc_lru,
    send_cmc_command_summary,
    switch_cmc_fault_page,
    update_cmc_fault_bit,
    update_cmc_transmit_data,
)


def test_cmc_module_metadata_and_router_prefix():
    meta = get_module_metadata()
    assert meta.mode == "cmc"
    assert meta.status == "active"
    assert router.prefix == "/api/cmc"


def test_cmc_20_standard_lru_selection_and_time_constant():
    # Select standard 707 LRA (007)
    st = select_cmc_lru(
        CmcLruSelectRequest(
            lru_id="707 LRA",
            name="Low Range Altimeter",
            code="007",
            time_constant="OFF",
        )
    )
    assert st["selected_lru"]["id"] == "707 LRA"
    assert st["selected_lru"]["code"] == "007"
    assert st["command_summary"]["eq_id"] == "007"

    # Select standard 711 VOR with 3.2s Time Constant
    st_vor = select_cmc_lru(
        CmcLruSelectRequest(
            lru_id="711 VOR",
            name="VHF Omnidirectional Range",
            code="011",
            time_constant="3.2",
        )
    )
    assert st_vor["selected_lru"]["code"] == "011"
    assert st_vor["selected_lru"]["time_constant"] == "3.2"

    # Manual Entry with 3-digit hex code
    st_man = select_cmc_lru(
        CmcLruSelectRequest(
            lru_id="MANUAL",
            name="Manual Entry LRU",
            code="1A3",
            time_constant="1.6",
        )
    )
    assert st_man["selected_lru"]["code"] == "1A3"


def test_cmc_transmit_background_data_and_label155():
    req = CmcTransmitDataRequest(
        date="11/13/26",
        time="09:30.0 GMT",
        flt_num="GA1234",
        city_pairs="KSEA KORD",
        flt_phase=7,
        aircraft_id="N777AA",
        config_word_bits={
            "PRINTER": True,  # Bit 11
            "AIDS": True,     # Bit 13
            "VHF3": True,     # Bit 15
            "WBS2": True,     # Bit 27
        },
    )
    st = update_cmc_transmit_data(req)
    tx = st["transmit_data"]
    assert tx["date"] == "11/13/26"
    assert tx["flt_phase"] == 7
    assert tx["config_word_bits"]["PRINTER"] is True
    assert tx["config_word_bits"]["AIDS"] is True
    assert tx["config_word_bits"]["LINK"] is False
    assert "label_155_config" in tx["words_hex"]

    # Verify Label 155 codec roundtrip
    raw_155 = encode_cmc_config_word_155(tx["config_word_bits"])
    dec_sw = decode_cmc_config_word_155(raw_155)
    assert dec_sw["PRINTER"] is True
    assert dec_sw["AIDS"] is True
    assert dec_sw["LINK"] is False
    assert dec_sw["WBS2"] is True

    # Verify Label 126 flight phase codec
    raw_126 = encode_cmc_flight_phase_126(7)
    assert decode_cmc_flight_phase_126(raw_126) == 7


def test_cmc_command_summary_label227_codec_and_function_switches():
    # 00H NO REQUEST
    raw_no_req = encode_cmc_command_227(sensor_code_hex="007", function_code=0x00, pad=0, sdi="00")
    dec_no_req = decode_cmc_command_227(raw_no_req)
    assert dec_no_req["label"] == "227"
    assert dec_no_req["eq_id"] == "007"
    assert dec_no_req["function_code"] == 0
    assert dec_no_req["function_hex"] == "00H"

    # 01H BITE TEST
    raw_bite = encode_cmc_command_227(sensor_code_hex="008", function_code=0x01, pad=0, sdi="01")
    dec_bite = decode_cmc_command_227(raw_bite)
    assert dec_bite["eq_id"] == "008"
    assert dec_bite["function_hex"] == "01H"
    assert dec_bite["sdi_name"] == "LEFT (1)"

    # 03H SHOP FAULTS
    st_sf = send_cmc_command_summary(
        CmcCommandSummaryRequest(function="SHOP FAULTS", eq_id="007", pad=0, sdi="00")
    )
    assert st_sf["command_summary"]["function_hex"] == "03H"
    assert st_sf["terminal"]["view"] == "SHOP_FAULTS"

    # 12H NEW FLIGHT (not IN-FLIGHT)
    st_nf = send_cmc_command_summary(
        CmcCommandSummaryRequest(function="NEW FLIGHT", eq_id="007")
    )
    assert st_nf["command_summary"]["function_hex"] == "12H"

    # 7FH LOGOFF
    st_lo = send_cmc_command_summary(
        CmcCommandSummaryRequest(function="LOGOFF", eq_id="007")
    )
    assert st_lo["command_summary"]["function_hex"] == "7FH"


def test_cmc_fault_summary_350_351_page_and_specific_lru_bits():
    # Select 707 LRA (007)
    select_cmc_lru(CmcLruSelectRequest(lru_id="707 LRA", name="Low Range Altimeter", code="007"))

    # Word #1 (350)
    switch_cmc_fault_page("350")
    st = update_cmc_fault_bit(bit=12, fault=True, command_ack=True, bite_inhibit=False, label="350")
    assert st["fault_summary"]["current_page"] == "350"
    assert st["fault_summary"]["bit_29_ack"] is True
    assert st["fault_summary"]["bite_test_inhibit"] is False

    # Check 707 LRA specific mapping: Bit 11 = LRU FAILURE, Bit 12 = TX ANTENNA FAILURE
    bits_view = {b["bit"]: b for b in st["fault_summary"]["bits"]}
    assert bits_view[11]["label"] == "LRU FAILURE"
    assert bits_view[12]["label"] == "TX ANTENNA FAILURE"
    assert bits_view[12]["status"] == "FAILURE (1)"
    assert bits_view[13]["label"] == "INDICATOR FAILURE"
    assert bits_view[13]["status"] == "OK (0)"
    assert bits_view[16]["label"] == "SPARE"
    assert bits_view[16]["status"] == "OFF (0)"
    assert bits_view[28]["label"] == "BITE TEST INHIBIT"
    assert bits_view[28]["status"] == "ENABLE (0)"
    assert bits_view[29]["label"] == "CMND WORD ACKNOWLEDGE"
    assert bits_view[29]["status"] == "ACK (1)"

    # Switch to Word #2 (351)
    st_p2 = switch_cmc_fault_page("351")
    assert st_p2["fault_summary"]["current_page"] == "351"


def test_cmc_terminal_tiered_error_messages():
    # 1. WARNING: NO CMND WORD ACK RCVD (no ACK in 3s)
    r1 = handle_cmc_terminal_action(CmcTerminalActionRequest(simulate_mode="NO_ACK"))
    assert r1["terminal"]["error"] == "WARNING: NO CMND WORD ACK RCVD"
    assert r1["config_data"]["valid"] is False
    assert r1["config_data"]["message"] == "WARNING: NO CMND WORD ACK RCVD"

    # 2. NO MAINTENANCE DATA RECEIVED (missing Label 350 in 5s)
    r2 = handle_cmc_terminal_action(CmcTerminalActionRequest(simulate_mode="NO_MAINTENANCE_DATA"))
    assert r2["terminal"]["error"] == "NO MAINTENANCE DATA RECEIVED"
    assert r2["config_data"]["message"] == "NO MAINTENANCE DATA RECEIVED"

    # 3. NO LRU RESPONSE IN 12 SECS (no Label 356 in 12s)
    r3 = handle_cmc_terminal_action(CmcTerminalActionRequest(simulate_mode="TIMEOUT_12S"))
    assert r3["terminal"]["error"] == "NO LRU RESPONSE IN 12 SECS"
    assert r3["config_data"]["message"] == "NO LRU RESPONSE IN 12 SECS"

    # 4. BLOCK WORD COUNT ERR (mismatch between STX and EOT)
    r4 = handle_cmc_terminal_action(CmcTerminalActionRequest(simulate_mode="BLOCK_COUNT_ERR"))
    assert r4["terminal"]["error"] == "BLOCK WORD COUNT ERR"
    assert r4["config_data"]["message"] == "BLOCK WORD COUNT ERR"


def test_cmc_terminal_interactive_keys_and_stx_eot_stream():
    # Press 1 -> Request Shop Faults with STX & EOT
    r_sf = handle_cmc_terminal_action(CmcTerminalActionRequest(action="KEY_PRESS", key="1"))
    assert r_sf["terminal"]["view"] == "SHOP_FAULTS"
    assert any("JcAIR - CMC TEST" in line for line in r_sf["terminal"]["lines"])
    assert r_sf["shop_faults"]["valid"] is True
    assert len(r_sf["terminal"]["words_hex"]) > 0

    # Press 2 -> Request Config Data with STX & EOT
    r_cfg = handle_cmc_terminal_action(CmcTerminalActionRequest(action="KEY_PRESS", key="2"))
    assert r_cfg["terminal"]["view"] == "CONFIG_DATA"
    assert any("4059000-902" in line for line in r_cfg["terminal"]["lines"])
    assert r_cfg["config_data"]["valid"] is True

    # Press <RETURN (Key 6) -> returns to MENU
    r_ret = handle_cmc_terminal_action(CmcTerminalActionRequest(action="KEY_PRESS", key="6"))
    assert r_ret["terminal"]["view"] == "MENU"
    assert any("BOEING CMC TERMINAL" in line for line in r_ret["terminal"]["lines"])
