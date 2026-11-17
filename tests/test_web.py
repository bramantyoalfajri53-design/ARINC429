"""API tests for ate-web (simulation only; no setpoint write routes)."""

from __future__ import annotations

import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ate_platform.web.app import create_app

PIN = "2468"


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ATE_FORCE_SIM", "1")
    monkeypatch.setenv("ATE_UI_PIN", PIN)
    app = create_app(simulation=True, out_dir=tmp_path)
    with TestClient(app) as c:
        yield c


def _login(client: TestClient) -> None:
    r = client.post("/api/auth/login", json={"pin": PIN})
    assert r.status_code == 200


def test_login_and_status(client: TestClient):
    assert client.get("/api/status").status_code == 401
    _login(client)
    r = client.get("/api/status")
    assert r.status_code == 200
    body = r.json()
    assert "station_id" in body
    assert "dc" in body and "measure" in body["dc"]
    assert "ac" in body and "measure" in body["ac"]
    assert "run" in body


def test_no_setpoint_routes(client: TestClient):
    _login(client)
    for path in ("/api/dc/setpoint", "/api/ac/setpoint", "/api/dc/output", "/api/ac/preset"):
        assert client.post(path, json={}).status_code == 404


def test_estop_without_lock(client: TestClient):
    _login(client)
    r = client.post("/api/estop")
    assert r.status_code == 200
    assert r.json()["action"] == "estop"


def test_start_dummy_plan_and_conflict(client: TestClient):
    _login(client)
    r = client.post(
        "/api/runs",
        json={
            "plan": "plans/dummy.yaml",
            "operator": "pytest",
            "uut_id": "DUMMY-UUT",
            "adapter_id": "dummy_ita",
        },
    )
    assert r.status_code == 200, r.text
    run_id = r.json()["run_id"]
    assert r.json()["active"] is True

    conflict = client.post(
        "/api/runs",
        json={"plan": "plans/dummy.yaml", "operator": "other"},
    )
    assert conflict.status_code == 409

    # Wait for completion (sim plan is short).
    deadline = time.time() + 30
    verdict = None
    while time.time() < deadline:
        snap = client.get(f"/api/runs/{run_id}").json()
        if not snap.get("active") and snap.get("verdict") and snap.get("verdict") != "RUNNING":
            verdict = snap.get("verdict")
            break
        time.sleep(0.2)
    assert verdict == "PASS"

    listed = client.get("/api/runs").json()
    assert any(x["run_id"] == run_id for x in listed["recent"])


def test_plans_listed(client: TestClient):
    _login(client)
    r = client.get("/api/plans")
    assert r.status_code == 200
    names = {p["name"] for p in r.json()["plans"]}
    assert "dummy.yaml" in names
