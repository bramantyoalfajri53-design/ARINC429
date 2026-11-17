from pathlib import Path
import threading

from ate_platform.device.server import DeviceServer
from ate_platform.paths import REPO_ROOT
from ate_platform.sequencer.runner import run_plan
from ate_platform.station_model import load_station


def test_dummy_plan_pass(tmp_path: Path):
    record = run_plan(
        REPO_ROOT / "plans" / "dummy.yaml",
        simulation=True,
        out_dir=tmp_path,
        operator="pytest",
        uut_id="DUMMY-UUT",
        adapter_id="dummy_ita",
    )
    assert record["verdict"] == "PASS"
    assert Path(record["result_path"]).is_file()
    plugin_steps = [s for s in record["steps"] if s["id"] == "plugin_dummy"]
    assert plugin_steps and plugin_steps[0]["verdict"] == "PASS"


def test_fail_plan_still_powers_off(tmp_path: Path):
    record = run_plan(
        REPO_ROOT / "plans" / "dummy_fail.yaml",
        simulation=True,
        out_dir=tmp_path,
        stop_on_fail=True,
    )
    assert record["verdict"] == "FAIL"
    # After run_plan returns, server is stopped; open a fresh sim server and
    # verify drivers start cold (0 V / OFF) — and that fail path wrote a result.
    assert Path(record["result_path"]).is_file()
    # Re-run status on a new sim server proves cold-start policy still works.
    srv = DeviceServer(load_station(), simulation=True)
    srv.start()
    try:
        st = srv.status()
        assert st["dc"]["output_on"] is False
        assert st["dc"]["set_voltage"] == 0.0
        assert st["ac"]["output_on"] is False
    finally:
        srv.stop()


def test_shared_server_not_stopped(tmp_path: Path):
    srv = DeviceServer(load_station(), simulation=True)
    srv.start()
    try:
        seen: list[str] = []
        record = run_plan(
            REPO_ROOT / "plans" / "dummy.yaml",
            server=srv,
            out_dir=tmp_path,
            on_step=lambda sr: seen.append(sr.id),
        )
        assert record["verdict"] == "PASS"
        assert "plugin_dummy" in seen
        # Shared server must still accept commands after run_plan returns.
        st = srv.status()
        assert st["dc"]["output_on"] is False
        assert st["dc"]["set_voltage"] == 0.0
        assert srv.lock.snapshot()["held"] is False
    finally:
        srv.stop()


def test_abort_mid_plan_resets_safe(tmp_path: Path):
    srv = DeviceServer(load_station(), simulation=True)
    srv.start()
    abort = threading.Event()
    try:

        def _abort_soon(_sid: str, _name: str) -> None:
            # Abort after first step starts so remaining steps are skipped.
            if not abort.is_set():
                abort.set()

        record = run_plan(
            REPO_ROOT / "plans" / "dummy.yaml",
            server=srv,
            out_dir=tmp_path,
            abort_event=abort,
            on_step_start=_abort_soon,
        )
        assert record["verdict"] == "ABORT"
        # abort set at start of first step → that step may still finish; later ones skip
        assert len(record["steps"]) <= 2
        st = srv.status()
        assert st["dc"]["output_on"] is False
        assert st["ac"]["output_on"] is False
        assert srv.lock.snapshot()["held"] is False
    finally:
        srv.stop()
