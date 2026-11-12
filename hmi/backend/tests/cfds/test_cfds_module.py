"""Unit, protocol encoding, simulation honesty, and HTTP integration tests for CFDS Mode."""

from __future__ import annotations

import asyncio
import json

import app as backend_app
from core.runtime import arinc_coordinator
from features.cfds import router
from features.cfds.schemas import (
    CfdsBiteCommandRequest,
    CfdsDiscreteSimulateRequest,
    CfdsLruSelectRequest,
    CfdsNormalSimulateRequest,
    CfdsTxParamsRequest,
)
from features.cfds.service import (
    encode_cfds_bite_word,
    get_module_metadata,
    select_cfds_lru,
    send_cfds_bite_command,
    simulate_discrete_mode,
    simulate_normal_mode,
    update_cfds_tx_params,
)


async def _asgi_cfds_request(
    method: str, path: str, body: dict[str, object] | None = None, cookie: str = ""
) -> tuple[int, dict[str, str], bytes]:
    raw_body = json.dumps(body).encode("utf-8") if body is not None else b""
    headers = [(b"host", b"testserver")]
    if raw_body:
        headers.append((b"content-type", b"application/json"))
        headers.append((b"content-length", str(len(raw_body)).encode("ascii")))
    if cookie:
        headers.append((b"cookie", cookie.encode("ascii")))

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": b"",
        "headers": headers,
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    }

    sent = False

    async def receive():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": raw_body, "more_body": False}
        return {"type": "http.disconnect"}

    status = 500
    resp_headers: dict[str, str] = {}
    chunks: list[bytes] = []

    async def send(message):
        nonlocal status
        if message["type"] == "http.response.start":
            status = message["status"]
            for k, v in message.get("headers", []):
                resp_headers[k.decode("latin1").lower()] = v.decode("latin1")
        elif message["type"] == "http.response.body":
            chunks.append(message.get("body", b""))

    await backend_app.app(scope, receive, send)
    return status, resp_headers, b"".join(chunks)


def test_cfds_module_metadata_and_router_prefix():
    meta = get_module_metadata()
    assert meta.mode == "cfds"
    assert meta.status == "active"
    assert meta.standards == ["ABD0018", "ABD0048"]
    assert router.prefix == "/api/cfds"


def test_cfds_bite_command_label227_exact_encodings():
    assert encode_cfds_bite_word("735", 0x00, sdi=0, ready=False, bit12=False)[1] == "0x807350E9"
    assert encode_cfds_bite_word("735", 0x12, sdi=0, ready=False, bit12=False)[1] == "0x927350E9"
    assert encode_cfds_bite_word("735", 0x11, sdi=0, ready=False, bit12=False)[1] == "0x917350E9"
    assert encode_cfds_bite_word("735", 0x70, sdi=2, ready=True, bit12=False)[1] == "0x707356E9"
    # Interactive CLR (bit12=0) vs SHFT+CLR (bit12=1)
    assert encode_cfds_bite_word("735", 0x08, sdi=0, ready=False, bit12=False)[1] == "0x087350E9"
    assert encode_cfds_bite_word("735", 0x08, sdi=0, ready=False, bit12=True)[1] == "0x887358E9"
    assert encode_cfds_bite_word("735", 0x08, sdi=0, ready=True, bit12=False)[1] == "0x887354E9"
    assert encode_cfds_bite_word("735", 0x08, sdi=0, ready=True, bit12=True)[1] == "0x08735CE9"


def test_cfds_normal_mode_figure58_and_error_simulation():
    passed = simulate_normal_mode(CfdsNormalSimulateRequest(scenario="FIGURE_58_PASS"))
    assert passed["source"] == "SIMULATION"
    assert passed["normal_rx"]["source"] == "SIMULATION"
    assert passed["normal_rx"]["status"] == "DATA_ACTIVE"
    assert passed["normal_rx"]["decoded_text"] == "JcAIR - CFDS TEST"
    assert len(passed["normal_rx"]["words"]) == 10

    err = simulate_normal_mode(CfdsNormalSimulateRequest(scenario="COUNT_ERROR"))
    assert err["normal_rx"]["status"] == "ERROR"
    assert "BLOCK WORD COUNT ERR" in str(err["normal_rx"]["error"])

    cleared = simulate_normal_mode(CfdsNormalSimulateRequest(scenario="CLEAR"))
    assert cleared["normal_rx"]["status"] == "WAITING"
    assert cleared["normal_rx"]["words"] == []


def test_cfds_discrete_mode_label355_simulation_boundary():
    single = simulate_discrete_mode(CfdsDiscreteSimulateRequest(scenario="SINGLE_FIG73"))
    assert single["discrete_rx"]["status"] == "DATA_ACTIVE"
    assert single["discrete_rx"]["source"] == "SIMULATION"
    assert len(single["discrete_rx"]["records"]) == 1
    assert single["discrete_rx"]["records"][0]["failureNumber"] == "002"
    assert single["discrete_rx"]["records"][0]["failureTypeString"] == "CHECK SUSPECT 1 SYSTEM"

    multi = simulate_discrete_mode(CfdsDiscreteSimulateRequest(scenario="MULTI_FIG74"))
    assert len(multi["discrete_rx"]["records"]) == 3
    assert all(rec["source"] == "SIMULATION" for rec in multi["discrete_rx"]["records"])

    cleared = simulate_discrete_mode(CfdsDiscreteSimulateRequest(scenario="CLEAR"))
    assert cleared["discrete_rx"]["status"] == "WAITING"
    assert cleared["discrete_rx"]["records"] == []


def test_cfds_coordinator_isolation_and_command_state():
    arinc_coordinator.acquire_mode("STANDARD")
    st = select_cfds_lru(CfdsLruSelectRequest(code="755", name="MMR", description="Multi Mode Receiver"))
    assert st["active_mode"] == "CFDS"
    assert st["selected_lru"]["code"] == "755"

    tx_state = update_cfds_tx_params(
        CfdsTxParamsRequest(
            date="121126",
            time="143000",
            flightNumber="GA429",
            cityPairs="CGKSUB",
            aircraftId="PK-GIA",
            flightPhase=6,
        )
    )
    assert tx_state["tx_params"]["cityPairs"] == "CGKSUB"
    assert tx_state["tx_params"]["flightPhase"] == 6

    cmd_state = send_cfds_bite_command(
        CfdsBiteCommandRequest(
            equipment_code="735",
            command_code=0x11,
            sdi=0,
            ready=False,
            bit12=False,
            channel="TX-A",
            submode="NORMAL",
            action_label="AIR_STEADY",
        )
    )
    assert cmd_state["last_tx_command"]["raw_hex"] == "0x917350E9"
    assert cmd_state["last_tx_command"]["source"] == "SIMULATION"
    assert cmd_state["tx_word"]["raw_hex"] == "917350E9"


def test_cfds_http_endpoints_require_auth_and_roundtrip():
    async def scenario():
        protected = [
            ("GET", "/api/cfds/status", None),
            ("GET", "/api/cfds/state", None),
            ("POST", "/api/cfds/lru", {"code": "735", "name": "TCAS"}),
            ("POST", "/api/cfds/tx-params", {"date": "111126", "cityPairs": "CGKDPS"}),
            ("POST", "/api/cfds/command", {"equipment_code": "735", "command_code": 0}),
            ("POST", "/api/cfds/normal/simulate", {"scenario": "FIGURE_58_PASS"}),
            ("POST", "/api/cfds/discrete/simulate", {"scenario": "SINGLE_FIG73"}),
            ("POST", "/api/cfds/channels/configure", {"channel": "TX-A", "speed": "100k"}),
        ]
        for method, path, payload in protected:
            status, _, _ = await _asgi_cfds_request(method, path, payload)
            assert status == 401, f"{method} {path} unexpectedly returned {status}"

        status, headers, _ = await _asgi_cfds_request(
            "POST", "/api/auth/login", {"pin": "2468"}
        )
        assert status == 200
        cookie = headers["set-cookie"].split(";", 1)[0]

        status, _, raw = await _asgi_cfds_request("GET", "/api/cfds/status", cookie=cookie)
        assert status == 200
        meta = json.loads(raw)
        assert meta["mode"] == "cfds" and meta["status"] == "active"

        status, _, _ = await _asgi_cfds_request(
            "POST", "/api/cfds/lru", {"code": "ZZZ", "name": "BAD"}, cookie=cookie
        )
        assert status == 422

        status, _, raw = await _asgi_cfds_request(
            "POST",
            "/api/cfds/command",
            {"equipment_code": "735", "command_code": 8, "ready": False, "bit12": True, "submode": "INTERACTIVE"},
            cookie=cookie,
        )
        assert status == 200
        cmd_resp = json.loads(raw)
        assert cmd_resp["last_tx_command"]["raw_hex"] == "0x887358E9"
        assert cmd_resp["source"] == "SIMULATION"

    asyncio.run(scenario())
