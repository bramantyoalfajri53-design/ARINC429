"""Route parity, auth, lease, HV confirmation, and SPA safety tests."""

from __future__ import annotations

import asyncio
import json

import app as backend_app


async def _asgi_request(method: str, path: str, body: bytes = b"", cookie: str = "") -> tuple[int, dict[str, str], bytes]:
    headers = [(b"host", b"testserver")]
    if body:
        headers.append((b"content-type", b"application/json"))
        headers.append((b"content-length", str(len(body)).encode("ascii")))
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
            return {"type": "http.request", "body": body, "more_body": False}
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


def test_expected_routes_registered():
    paths = {route.path for route in backend_app.app.routes}
    expected = {
        "/api/auth/login",
        "/api/auth/logout",
        "/api/auth/session",
        "/api/state",
        "/api/control/acquire",
        "/api/control/heartbeat",
        "/api/control/release",
        "/api/dc/setpoint",
        "/api/dc/output",
        "/api/dc/preset",
        "/api/ac/setpoint",
        "/api/ac/output",
        "/api/ac/preset",
        "/api/estop",
        "/api/gpib/rescan",
        "/api/mode/simulation",
        "/ws/telemetry",
    }
    assert expected.issubset(paths)


def test_auth_control_and_hv_interlock_flow():
    async def scenario():
        async with backend_app.lifespan(backend_app.app):
            status, _, _ = await _asgi_request("GET", "/api/auth/session")
            assert status == 401

            status, headers, raw = await _asgi_request(
                "POST", "/api/auth/login", json.dumps({"pin": "2468"}).encode("utf-8")
            )
            assert status == 200
            assert json.loads(raw) == {"ok": True}
            cookie = headers["set-cookie"].split(";", 1)[0]

            status, _, raw = await _asgi_request("GET", "/api/state", cookie=cookie)
            assert status == 200
            state = json.loads(raw)
            assert "dc" in state and "ac" in state and "lease" in state

            status, _, _ = await _asgi_request(
                "POST", "/api/dc/setpoint", json.dumps({"voltage": 12}).encode("utf-8"), cookie=cookie
            )
            assert status == 403  # Must acquire control first

            status, _, _ = await _asgi_request("POST", "/api/control/acquire", b"{}", cookie=cookie)
            assert status == 200

            status, _, _ = await _asgi_request(
                "POST", "/api/ac/setpoint", json.dumps({"voltage": 200}).encode("utf-8"), cookie=cookie
            )
            assert status == 200

            status, _, raw = await _asgi_request(
                "POST",
                "/api/ac/output",
                json.dumps({"enabled": True, "confirm_high_voltage": False}).encode("utf-8"),
                cookie=cookie,
            )
            assert status == 409
            assert json.loads(raw)["detail"]["needs_confirm"] is True

            status, _, _ = await _asgi_request(
                "POST",
                "/api/ac/output",
                json.dumps({"enabled": True, "confirm_high_voltage": True}).encode("utf-8"),
                cookie=cookie,
            )
            assert status == 200

            status, _, _ = await _asgi_request("POST", "/api/estop", b"{}", cookie=cookie)
            assert status == 200

            status, _, _ = await _asgi_request("POST", "/api/auth/logout", b"{}", cookie=cookie)
            assert status == 200

    asyncio.run(scenario())

