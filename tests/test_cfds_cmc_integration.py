"""Integration tests verifying CFDS and Boeing CMC operating modes in ate-web."""

from __future__ import annotations

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


def test_standard_mode_regression_intact(client: TestClient):
    """Verify that Standard Mode and existing ARINC APIs are 100% untouched and functional."""
    _login(client)

    # Status check
    r = client.get("/api/arinc/status")
    assert r.status_code == 200
    snap = r.json()
    assert "screen_stack" in snap
    assert "app_mode" in snap
    assert "tx" in snap
    assert "rx" in snap
    assert snap["app_mode"] == "standard"

    # Mode switching to standard
    r_std = client.post("/api/arinc/mode", json={"mode": "standard"})
    assert r_std.status_code == 200
    assert r_std.json()["app_mode"] == "standard"

    # Mode switching to cfds
    r_cfds = client.post("/api/arinc/mode", json={"mode": "cfds"})
    assert r_cfds.status_code == 200
    assert r_cfds.json()["app_mode"] == "cfds"

    # Mode switching to cmc
    r_cmc = client.post("/api/arinc/mode", json={"mode": "cmc"})
    assert r_cmc.status_code == 200
    assert r_cmc.json()["app_mode"] == "cmc"

    # Catalog & Library
    r_cat = client.get("/api/arinc/catalog")
    assert r_cat.status_code == 200
    assert "catalog" in r_cat.json()

    r_lib = client.get("/api/arinc/library")
    assert r_lib.status_code == 200
    assert "labels" in r_lib.json()


def test_cfds_api_integration(client: TestClient):
    """Verify CFDS Mode endpoints mounted on ate-platform."""
    _login(client)

    # Status & metadata
    r_status = client.get("/api/cfds/status")
    assert r_status.status_code == 200
    assert r_status.json()["mode"].lower() == "cfds"

    # State
    r_state = client.get("/api/cfds/state")
    assert r_state.status_code == 200
    state = r_state.json()
    assert "selected_lru" in state
    assert "tx_params" in state

    # LRU selection
    r_lru = client.post("/api/cfds/lru", json={"code": "020", "name": "FMGC 1"})
    assert r_lru.status_code == 200
    assert r_lru.json()["selected_lru"]["code"] == "020"

    # Normal mode burst simulation (Figure 58)
    r_burst = client.post("/api/cfds/normal/simulate", json={"mode_type": "ABD0048"})
    assert r_burst.status_code == 200
    burst_res = r_burst.json()
    assert "normal_rx" in burst_res
    assert burst_res["normal_rx"]["status"] == "DATA_ACTIVE"
    assert "JcAIR" in burst_res["normal_rx"]["decoded_text"]

    # BITE command (Label 227)
    r_cmd = client.post(
        "/api/cfds/command",
        json={
            "equipment_code": "020",
            "command_code": 1,
            "sdi": 0,
            "ready": True,
            "bit12": False,
            "channel": "TX-A",
            "submode": "NORMAL",
            "action_label": "System Test",
        },
    )
    assert r_cmd.status_code == 200
    assert "last_tx_command" in r_cmd.json()
    assert r_cmd.json()["last_tx_command"] is not None


def test_cmc_api_integration(client: TestClient):
    """Verify Boeing CMC Mode endpoints (Aeroflex T1200B / ARINC 604-1) mounted on ate-platform."""
    _login(client)

    # CMC State
    r_state = client.get("/api/cmc/state")
    assert r_state.status_code == 200
    body = r_state.json()
    assert "metadata" in body
    assert body["metadata"]["mode"] == "cmc"
    assert "standard_lrus" in body
    assert len(body["standard_lrus"]) == 20

    # Select Boeing LRU
    r_lru = client.post(
        "/api/cmc/lru",
        json={"lru_id": "FMC-L", "name": "Flight Management Computer L", "code": "001"},
    )
    assert r_lru.status_code == 200
    assert r_lru.json()["selected_lru"]["code"] == "001"

    # Send Command Word 227
    r_cmd = client.post(
        "/api/cmc/command",
        json={
            "function_code": "00",
            "sdi": "00",
            "equipment_id": "001",
            "ssm": "NO",
            "parity": "ODD",
            "raw_hex": "00E30227",
            "label": "227",
        },
    )
    assert r_cmd.status_code == 200
    assert "command_summary" in r_cmd.json()
    assert r_cmd.json()["command_summary"]["handshake_status"] == "TRANSMITTED"

    # Fault summary toggle
    r_fault = client.post(
        "/api/cmc/fault-summary",
        json={"bit": 11, "fault": True, "label": "350", "sdi": "00", "ssm": "00", "has_words": True},
    )
    assert r_fault.status_code == 200
    assert "fault_summary" in r_fault.json()

    # Fault page switch
    r_page = client.post("/api/cmc/fault-page", json={"label": "351"})
    assert r_page.status_code == 200
    assert r_page.json()["fault_summary"]["current_page"] == "351"
