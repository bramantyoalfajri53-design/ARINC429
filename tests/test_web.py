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


def test_arinc_start_stop_in_simulation(client: TestClient):
    _login(client)
    r = client.post("/api/arinc/start")
    assert r.status_code == 200, r.text
    snap = r.json()
    assert snap.get("running") is True
    r2 = client.post("/api/arinc/stop")
    assert r2.status_code == 200
    assert r2.json().get("running") is False


def test_cfds_device_detect_and_simulation_mode(client: TestClient):
    _login(client)
    # 1. Real Device Mode without physical device -> Disconnected
    r = client.get("/api/arinc/device/detect?lru=709&bus=A")
    assert r.status_code == 200
    data = r.json()
    assert data["mode"] == "REAL"
    assert data["connected"] is False

    # 2. Enable Simulation Mode explicitly
    r_sim = client.post("/api/arinc/simulation", json={"enabled": True})
    assert r_sim.status_code == 200

    # 3. Detect in Simulation Mode -> Connected as SIMULATION
    r_detect_sim = client.get("/api/arinc/device/detect?lru=709&bus=A")
    assert r_detect_sim.status_code == 200
    sim_data = r_detect_sim.json()
    assert sim_data["mode"] == "SIMULATION"
    assert sim_data["connected"] is True
    assert sim_data["simulation"] is True

    # 4. Disable Simulation Mode -> Reverts to Real Device Mode without hardware -> Disconnected
    r_unsim = client.post("/api/arinc/simulation", json={"enabled": False})
    assert r_unsim.status_code == 200

    r_detect_revert = client.get("/api/arinc/device/detect?lru=709&bus=A")
    assert r_detect_revert.status_code == 200
    revert_data = r_detect_revert.json()
    assert revert_data["mode"] == "REAL"
    assert revert_data["connected"] is False


def test_dme_handshake_diagnostic(client: TestClient):
    _login(client)
    # 1. Trigger handshake with 134.40 MHz (ATC-1400A Chan 1X) in simulation
    r = client.post("/api/arinc/dme/handshake", json={
        "bus": "A",
        "freq_mhz": 134.40,
        "rate_ms": 100,
        "arm_stimulus": True,
        "sim_scenario": "active",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["status_code"] == "CONNECTED_ACTIVE"
    assert data["status_level"] == "ok"
    assert "DME CONNECTED & ACTIVE" in data["status"]
    assert data["freq_mhz"] == 134.40
    assert data["bnr_distance"]["dist_nm"] == 50.0
    assert data["echo"]["status"] == "ECHO OK"
    assert len(data["words"]) >= 2
    assert "formatted_bin" in data["words"][0]
    assert data["checklist"] is not None

    # 2. Get diagnostic in loopback scenario
    r_diag = client.get("/api/arinc/dme/diagnostic?bus=A&sim_scenario=loopback_only")
    assert r_diag.status_code == 200
    diag_data = r_diag.json()
    assert diag_data["status_code"] == "LOOPBACK"
    assert diag_data["status_level"] == "warn"
    assert "LOOPBACK" in diag_data["status"]

    # 3. Disconnected scenario
    r_disc = client.get("/api/arinc/dme/diagnostic?bus=A&sim_scenario=disconnected")
    assert r_disc.status_code == 200
    disc_data = r_disc.json()
    assert disc_data["status_code"] == "DISCONNECTED"
    assert disc_data["status_level"] == "danger"
    assert "DISCONNECTED" in disc_data["status"]
