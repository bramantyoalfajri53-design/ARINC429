"""Unit and API tests for shared ARINC 429 codec, coordinator isolation, and mode routes."""

from __future__ import annotations

import asyncio

import app as backend_app
from core.arinc429 import (
    Arinc429Coordinator,
    decode_arinc429_word,
    decode_cmc_fault_summary_word,
    encode_arinc429_word,
    encode_cmc_fault_summary_word,
)
from tests.shared.test_app_routes_and_auth import _asgi_request


def test_arinc429_word_codec_roundtrip_and_parity():
    raw_odd = encode_arinc429_word("270", sdi="01", data_19bit=0x12ABC, ssm="NO", parity="ODD")
    dec = decode_arinc429_word(raw_odd, expected_parity="ODD")
    assert dec.label_oct == "270"
    assert dec.sdi == "01"
    assert dec.data_19bit == 0x12ABC
    assert dec.ssm == "NO"
    assert dec.parity_ok is True

    raw_350 = encode_cmc_fault_summary_word("350", active_fault_bits=[11, 15, 28], command_ack=True)
    dec_350 = decode_cmc_fault_summary_word(raw_350)
    assert dec_350["bit_29_ack"] is True
    assert dec_350["active_fault_bits"] == [11, 15, 28]


def test_coordinator_mode_isolation_and_csv_export():
    coord = Arinc429Coordinator(simulation_mode=True)
    coord.acquire_mode("CFDS")
    w = encode_arinc429_word("356", sdi="00", data_19bit=0x0041, ssm="NO")
    coord.record_rx_word("CFDS", "RX-A", w, detail="CFDS RX")
    assert len(coord.get_rx_history("CFDS")) == 1
    assert len(coord.get_rx_history("CMC")) == 0

    coord.acquire_mode("CMC")
    assert len(coord.get_rx_history("CFDS")) == 0

    csv_text, mime = coord.export_logs("csv")
    assert mime == "text/csv"
    assert "timestamp,mode,source,direction,channel,label,raw_hex,detail" in csv_text


def test_arinc429_http_routes_registered_and_auth_protected():
    openapi_paths = backend_app.app.openapi().get("paths", {})
    expected_methods = {
        "/api/arinc429/status": "get",
        "/api/arinc429/mode": "post",
        "/api/arinc429/bus": "post",
        "/api/arinc429/channels": "post",
        "/api/arinc429/export": "get",
        "/api/standard/status": "get",
        "/api/standard/transmit": "post",
        "/api/cfds/status": "get",
        "/api/cmc/state": "get",
        "/api/cmc/lru": "post",
        "/api/cmc/command": "post",
        "/api/cmc/fault-summary": "post",
        "/api/cmc/request-config-data": "post",
        "/api/cmc/request-shop-faults": "post",
    }
    assert set(expected_methods).issubset(set(openapi_paths))
    for path, method in expected_methods.items():
        assert method in openapi_paths[path]

    async def scenario():
        for path, method in expected_methods.items():
            status, _, _ = await _asgi_request(method.upper(), path)
            assert status == 401

    asyncio.run(scenario())

