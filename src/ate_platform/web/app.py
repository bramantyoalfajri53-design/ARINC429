"""FastAPI operator daemon: one DeviceServer, REST + WebSocket, no setpoint writes."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ate_platform.device.server import DeviceServer
from ate_platform.paths import REPO_ROOT, env, load_dotenv
from ate_platform.results.store import list_runs, load_run
from ate_platform.station_model import load_station
from ate_platform.web.arinc_session import ArincSession
from ate_platform.web.auth import (
    authenticate_pin,
    clear_session_cookie,
    create_session_id,
    issue_session_cookie,
    read_session_id,
)
from ate_platform.web.run_manager import RunManager

logger = logging.getLogger("ate_platform.web")

WEB_ROOT = REPO_ROOT / "web"
PLANS_DIR = REPO_ROOT / "plans"


class LoginBody(BaseModel):
    pin: str = Field(min_length=1, max_length=64)


class StartRunBody(BaseModel):
    plan: str = Field(min_length=1, max_length=256)
    operator: str = Field(default="operator", max_length=128)
    uut_id: str = Field(default="DUMMY-UUT", max_length=128)
    adapter_id: str = Field(default="dummy_ita", max_length=128)


class ArincModeBody(BaseModel):
    mode: str = Field(default="standard", max_length=8)


class ArincBitRateBody(BaseModel):
    high_speed: bool = False
    buses: list[str] | None = None


class ArincChannelBody(BaseModel):
    bus: str = Field(default="A", max_length=1)
    high_speed: bool | None = None
    selftest: bool | None = None
    tx_enable: bool | None = None
    rx_enable: bool | None = None
    odd_parity: bool | None = None
    display_mode: str | None = Field(default=None, max_length=3)
    bit_rate_kbps: float | None = Field(default=None, ge=8.0, le=125.0)


class ArincTxSlotBody(BaseModel):
    bus: str = Field(default="A", max_length=1)
    slot: int = Field(default=0, ge=0, le=9)
    mode: str = Field(default="raw", max_length=8)
    label: str = Field(default="000", max_length=8)
    data: str = Field(default="0", max_length=16)
    data19: str | None = Field(default=None, max_length=16)
    pad3: int | None = Field(default=None, ge=0, le=7)
    data16: str | None = Field(default=None, max_length=8)
    raw_word: str | None = Field(default=None, max_length=18)
    sdi: int = Field(default=0, ge=0, le=3)
    ssm: str = Field(default="NML", max_length=8)
    rate_ms: int = Field(default=150, ge=10, le=5000)
    odd_parity: bool = True
    enabled: bool | None = None
    freq_khz: float | None = Field(default=None, ge=100.0, le=1799.9)
    profile: str | None = Field(default=None, max_length=64)
    eng_value: float | str | None = None


class ArincClearSlotBody(BaseModel):
    bus: str = Field(default="A", max_length=1)
    slot: int = Field(default=0, ge=0, le=9)


class ArincRxBody(BaseModel):
    bus: str = Field(default="A", max_length=1)
    enabled: bool | None = None
    filter_labels: list[str] | None = None
    filter_sdi: int | None = Field(default=None, ge=0, le=3)


class ArincClearRxBody(BaseModel):
    bus: str | None = Field(default=None, max_length=1)


class ArincScreenBody(BaseModel):
    screen: str = Field(min_length=1, max_length=64)


class ArincProfileBody(BaseModel):
    profile: str = Field(min_length=1, max_length=64)
    tx_ch: str | None = Field(default=None, max_length=1)
    rx_ch: str | None = Field(default=None, max_length=1)
    apply_tx: bool = True
    apply_rx: bool = True
    reset: bool = False


class ArincActiveChannelsBody(BaseModel):
    tx_ch: str | None = Field(default=None, max_length=1)
    rx_ch: str | None = Field(default=None, max_length=1)


class ArincLabelValueBody(BaseModel):
    profile: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=8)
    value: float | str
    word_index: int | None = Field(default=None, ge=1, le=2)


class ArincLabelSpecBody(BaseModel):
    label: str = Field(min_length=1, max_length=8)
    funct: str = Field(default="", max_length=64)
    encoding: str = Field(default="raw", max_length=24)
    units: str = Field(default="", max_length=16)
    sdi: int = Field(default=0, ge=0, le=3)
    ssm: str = Field(default="NML", max_length=8)
    parity: str = Field(default="ODD", max_length=8)
    rate_ms: int = Field(default=150, ge=10, le=5000)
    direction: str = Field(default="tx", max_length=8)
    eng_name: str | None = Field(default=None, max_length=64)
    eng_min: float = 0.0
    eng_max: float = 0.0
    eng_step: float = 1.0
    eng_default: float | str | None = None
    bcd_scale: float = 1.0
    bcd_digits: int = Field(default=5, ge=1, le=8)
    bnr_lsb: float = 1.0
    bnr_offset: float = 0.0
    bnr_bits: int = Field(default=16, ge=1, le=19)
    word_index: int = Field(default=1, ge=1, le=2)
    iso5_chars: int = Field(default=3, ge=1, le=3)
    bus: str = Field(default="", max_length=1)
    source: str = Field(default="custom", max_length=16)
    pads: str = Field(default="-", max_length=16)


class ArincProfileUpsertBody(BaseModel):
    id: str = Field(min_length=1, max_length=48)
    name: str = Field(min_length=1, max_length=128)
    funct: str = Field(default="", max_length=64)
    bus: str = Field(default="A", max_length=1)
    tx_ch: str = Field(default="A", max_length=1)
    rx_ch: str = Field(default="A", max_length=1)
    characteristic: str = Field(default="", max_length=32)
    notes: str = Field(default="", max_length=2000)
    high_speed: bool = False
    labels: list[ArincLabelSpecBody]


class ArincSimulationBody(BaseModel):
    enabled: bool


class ArincTrapBody(BaseModel):
    bus: str = Field(default="A", max_length=1)
    label: str = Field(min_length=1, max_length=8)
    sdi: int | None = Field(default=None, ge=0, le=3)
    clear: bool = False


class ArincRxPageBody(BaseModel):
    bus: str = Field(default="A", max_length=1)
    page: int = Field(default=0, ge=0, le=32)


class ArincTimeConstBody(BaseModel):
    seconds: float = Field(default=0.0, ge=0.0, le=16.0)


class ArincLineBody(BaseModel):
    which: str = Field(default="ln1", max_length=8)
    kind: str = Field(default="tx", max_length=4)
    bus: str = Field(default="A", max_length=1)


class ArincDmeModeBody(BaseModel):
    mode: str = Field(min_length=1, max_length=16)
    reset: bool = False


class ArincDmeSlotBody(BaseModel):
    index: int = Field(default=0, ge=0, le=9)
    bus: str = Field(default="A", max_length=1)
    freq_mhz: float | None = None
    mode: str | None = Field(default=None, max_length=8)
    nav: str | None = Field(default=None, max_length=8)
    disp: bool | None = None
    ident: bool | None = None
    sdi: int | None = Field(default=None, ge=0, le=3)
    ssm: str | None = Field(default=None, max_length=8)
    pad: str | None = Field(default=None, max_length=16)
    parity: str = Field(default="ODD", max_length=8)
    rate_ms: int = Field(default=100, ge=10, le=5000)
    enabled: bool | None = None


class ArincDmeHandshakeBody(BaseModel):
    bus: str = Field(default="A", max_length=1)
    freq_mhz: float = Field(default=134.40, ge=100.0, le=140.0)
    rate_ms: int = Field(default=100, ge=10, le=5000)
    arm_stimulus: bool = True
    sim_scenario: str = Field(default="auto", max_length=32)


class ArincMmrMenuBody(BaseModel):
    menu: str = Field(min_length=1, max_length=8)


class ArincMmrIncBody(BaseModel):
    enabled: bool = False


def create_app(
    *,
    simulation: bool | None = None,
    out_dir: Path | None = None,
    station_path: str | Path | None = None,
) -> FastAPI:
    load_dotenv()
    state: dict[str, Any] = {"server": None, "runs": None, "arinc": None}

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        station = load_station(station_path)
        server = DeviceServer(station, simulation=simulation)
        server.start()
        runs = RunManager(server, out_dir=out_dir)
        arinc = ArincSession(simulation=simulation)
        state["server"] = server
        state["runs"] = runs
        state["arinc"] = arinc
        logger.info(
            "ate-web ready station=%s sim=%s",
            station.station_id,
            server.dc.simulation_mode or server.ac.simulation_mode,
        )
        try:
            yield
        finally:
            try:
                arinc.stop()
            except Exception:
                pass
            try:
                server.estop()
            except Exception:
                pass
            server.stop()
            state["server"] = None
            state["runs"] = None
            state["arinc"] = None

    app = FastAPI(title="ATE Operator UI", version="0.1.0", lifespan=lifespan)

    def require_session(request: Request) -> str:
        session_id = read_session_id(request)
        if not session_id:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return session_id

    def get_server() -> DeviceServer:
        server = state["server"]
        if server is None:
            raise HTTPException(status_code=503, detail="Device server not ready")
        return server

    def get_runs() -> RunManager:
        runs = state["runs"]
        if runs is None:
            raise HTTPException(status_code=503, detail="Run manager not ready")
        return runs

    def get_arinc() -> ArincSession:
        arinc = state["arinc"]
        if arinc is None:
            raise HTTPException(status_code=503, detail="ARINC session not ready")
        return arinc

    def enrich_status(server: DeviceServer) -> dict[str, Any]:
        snap = server.status()
        try:
            dc_m = server.dc_measure()
        except Exception as exc:
            dc_m = {"error": str(exc)}
        try:
            ac_m = server.ac_measure()
        except Exception as exc:
            ac_m = {"error": str(exc)}
        snap["dc"] = {**snap.get("dc", {}), "measure": dc_m}
        snap["ac"] = {**snap.get("ac", {}), "measure": ac_m}
        snap["run"] = get_runs().snapshot()
        return snap

    @app.post("/api/auth/login")
    def login(body: LoginBody):
        if not authenticate_pin(body.pin):
            raise HTTPException(status_code=401, detail="Invalid PIN")
        session_id = create_session_id()
        response = JSONResponse({"ok": True})
        issue_session_cookie(response, session_id)
        return response

    @app.post("/api/auth/logout")
    def logout(request: Request):
        response = JSONResponse({"ok": True})
        clear_session_cookie(response)
        return response

    @app.get("/api/auth/session")
    def session_info(_sid: str = Depends(require_session)):
        return {"ok": True}

    @app.get("/api/status")
    def api_status(_sid: str = Depends(require_session)):
        return enrich_status(get_server())

    @app.get("/api/plans")
    def api_plans(_sid: str = Depends(require_session)):
        plans: list[dict[str, str]] = []
        if PLANS_DIR.is_dir():
            for path in sorted(PLANS_DIR.glob("*.yaml")):
                plans.append(
                    {
                        "id": path.stem,
                        "path": str(path.relative_to(REPO_ROOT)),
                        "name": path.name,
                    }
                )
        return {"plans": plans}

    @app.post("/api/runs")
    def api_start_run(body: StartRunBody, _sid: str = Depends(require_session)):
        runs = get_runs()
        plan = body.plan
        if not Path(plan).is_file() and not (REPO_ROOT / plan).is_file():
            # allow bare filename under plans/
            candidate = PLANS_DIR / Path(plan).name
            if candidate.is_file():
                plan = str(candidate.relative_to(REPO_ROOT))
            else:
                raise HTTPException(status_code=404, detail=f"Plan not found: {body.plan}")
        try:
            snap = runs.start(
                plan,
                operator=body.operator,
                uut_id=body.uut_id,
                adapter_id=body.adapter_id,
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return snap

    @app.get("/api/runs")
    def api_list_runs(_sid: str = Depends(require_session)):
        runs = get_runs()
        live = runs.snapshot()
        out_dir = runs.out_dir
        return {"active": live, "recent": list_runs(out_dir)}

    @app.get("/api/runs/{run_id}")
    def api_get_run(run_id: str, _sid: str = Depends(require_session)):
        runs = get_runs()
        live = runs.snapshot()
        if live.get("run_id") == run_id:
            return {"live": True, **live}
        record = load_run(run_id, out_dir=runs.out_dir)
        if record is None:
            raise HTTPException(status_code=404, detail="Run not found")
        return {"live": False, **record}

    @app.post("/api/runs/{run_id}/abort")
    def api_abort_run(run_id: str, _sid: str = Depends(require_session)):
        try:
            return get_runs().abort(run_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.post("/api/estop")
    def api_estop(_sid: str = Depends(require_session)):
        server = get_server()
        runs = get_runs()
        live = runs.snapshot()
        if live.get("active") and live.get("run_id"):
            try:
                runs.abort(str(live["run_id"]))
            except KeyError:
                pass
        try:
            get_arinc().stop()
        except Exception:
            pass
        server.estop()
        return {"ok": True, "action": "estop"}

    @app.get("/api/arinc/status")
    def api_arinc_status(_sid: str = Depends(require_session)):
        return get_arinc().snapshot()

    @app.post("/api/arinc/mode")
    def api_arinc_mode(body: ArincModeBody, _sid: str = Depends(require_session)):
        arinc = get_arinc()
        try:
            arinc.set_mode(body.mode)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return arinc.snapshot()

    @app.post("/api/arinc/screen/push")
    def api_arinc_screen_push(body: ArincScreenBody, _sid: str = Depends(require_session)):
        get_arinc().push_screen(body.screen)
        return get_arinc().snapshot()

    @app.post("/api/arinc/screen/pop")
    def api_arinc_screen_pop(_sid: str = Depends(require_session)):
        get_arinc().pop_screen()
        return get_arinc().snapshot()

    @app.post("/api/arinc/start")
    def api_arinc_start(_sid: str = Depends(require_session)):
        arinc = get_arinc()
        try:
            arinc.start()
        except ImportError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return arinc.snapshot()

    @app.post("/api/arinc/stop")
    def api_arinc_stop(_sid: str = Depends(require_session)):
        arinc = get_arinc()
        arinc.stop()
        return arinc.snapshot()

    @app.post("/api/arinc/simulation")
    def api_arinc_simulation(body: ArincSimulationBody, _sid: str = Depends(require_session)):
        arinc = get_arinc()
        return arinc.set_simulation_override(body.enabled)

    @app.get("/api/arinc/device/detect")
    def api_arinc_device_detect(lru: str = "709", bus: str = "A", _sid: str = Depends(require_session)):
        arinc = get_arinc()
        return arinc.check_lru_connected(lru_code=lru, bus=bus)

    @app.post("/api/arinc/device/detect")
    def api_arinc_device_detect_post(lru: str = "709", bus: str = "A", _sid: str = Depends(require_session)):
        arinc = get_arinc()
        return arinc.check_lru_connected(lru_code=lru, bus=bus)

    @app.post("/api/arinc/bitrate")
    def api_arinc_bitrate(body: ArincBitRateBody, _sid: str = Depends(require_session)):
        arinc = get_arinc()
        buses = body.buses
        if buses:
            for b in buses:
                if b.upper() not in "ABCD":
                    raise HTTPException(status_code=400, detail="buses must be A-D")
        arinc.set_bit_rate(body.high_speed, buses)
        return arinc.snapshot()

    @app.post("/api/arinc/channel")
    def api_arinc_channel(body: ArincChannelBody, _sid: str = Depends(require_session)):
        arinc = get_arinc()
        bus = body.bus.upper()
        if bus not in "ABCD":
            raise HTTPException(status_code=400, detail="bus must be A-D")
        try:
            arinc.configure_channel(
                bus,
                high_speed=body.high_speed,
                selftest=body.selftest,
                tx_enable=body.tx_enable,
                rx_enable=body.rx_enable,
                odd_parity=body.odd_parity,
                display_mode=body.display_mode,
                bit_rate_kbps=body.bit_rate_kbps,
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return arinc.snapshot()

    @app.post("/api/arinc/tx/slot")
    def api_arinc_tx_slot(body: ArincTxSlotBody, _sid: str = Depends(require_session)):
        arinc = get_arinc()
        bus = body.bus.upper()
        if bus not in "ABCD":
            raise HTTPException(status_code=400, detail="bus must be A-D")
        try:
            arinc.configure_tx_slot(
                bus,
                body.slot,
                mode=body.mode,
                label=body.label,
                data=body.data,
                data19=body.data19,
                pad3=body.pad3,
                data16=body.data16,
                sdi=body.sdi,
                ssm=body.ssm,
                rate_ms=body.rate_ms,
                odd_parity=body.odd_parity,
                enabled=body.enabled,
                raw_word=body.raw_word,
                freq_khz=body.freq_khz,
                profile=body.profile,
                eng_value=body.eng_value,
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return arinc.snapshot()

    @app.post("/api/arinc/tx/slot/clear")
    def api_arinc_tx_slot_clear(body: ArincClearSlotBody, _sid: str = Depends(require_session)):
        arinc = get_arinc()
        bus = body.bus.upper()
        if bus not in "ABCD":
            raise HTTPException(status_code=400, detail="bus must be A-D")
        arinc.clear_tx_slot(bus, body.slot)
        return arinc.snapshot()

    @app.post("/api/arinc/rx")
    def api_arinc_rx(body: ArincRxBody, _sid: str = Depends(require_session)):
        arinc = get_arinc()
        bus = body.bus.upper()
        if bus not in "ABCD":
            raise HTTPException(status_code=400, detail="bus must be A-D")
        try:
            arinc.configure_rx(
                bus,
                enabled=body.enabled,
                filter_labels=body.filter_labels,
                filter_sdi=body.filter_sdi,
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return arinc.snapshot()

    @app.post("/api/arinc/rx/clear")
    def api_arinc_rx_clear(body: ArincClearRxBody, _sid: str = Depends(require_session)):
        arinc = get_arinc()
        if body.bus:
            bus = body.bus.upper()
            if bus not in "ABCD":
                raise HTTPException(status_code=400, detail="bus must be A-D")
            arinc.clear_rx_hits(bus)
        else:
            arinc.clear_rx_hits()
        return arinc.snapshot()

    @app.get("/api/arinc/profiles")
    def api_arinc_profiles(_sid: str = Depends(require_session)):
        return {"profiles": get_arinc().available_profiles()}

    @app.get("/api/arinc/profile/{profile_id}")
    def api_arinc_profile_detail(profile_id: str, _sid: str = Depends(require_session)):
        try:
            return get_arinc().profile_detail(profile_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.post("/api/arinc/profile/apply")
    def api_arinc_profile_apply(body: ArincProfileBody, _sid: str = Depends(require_session)):
        arinc = get_arinc()
        try:
            return arinc.apply_profile(
                body.profile,
                tx_ch=body.tx_ch,
                rx_ch=body.rx_ch,
                apply_tx=body.apply_tx,
                apply_rx=body.apply_rx,
                reset=body.reset,
            )
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/arinc/profile/label")
    def api_arinc_profile_label(body: ArincLabelValueBody, _sid: str = Depends(require_session)):
        arinc = get_arinc()
        try:
            return arinc.set_label_value(body.profile, body.label, body.value, word_index=body.word_index)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/arinc/profile")
    def api_arinc_profile_create(body: ArincProfileUpsertBody, _sid: str = Depends(require_session)):
        try:
            return get_arinc().upsert_profile(jsonable_encoder(body), overwrite=False)
        except FileExistsError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.put("/api/arinc/profile/{profile_id}")
    def api_arinc_profile_update(profile_id: str, body: ArincProfileUpsertBody, _sid: str = Depends(require_session)):
        payload = jsonable_encoder(body)
        payload["id"] = profile_id
        try:
            return get_arinc().upsert_profile(payload, overwrite=True)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.delete("/api/arinc/profile/{profile_id}")
    def api_arinc_profile_delete(profile_id: str, _sid: str = Depends(require_session)):
        try:
            get_arinc().remove_profile(profile_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"ok": True, "deleted": profile_id}

    @app.get("/api/arinc/catalog")
    def api_arinc_catalog(_sid: str = Depends(require_session)):
        return {"catalog": get_arinc().catalog()}

    @app.get("/api/arinc/library")
    def api_arinc_library(_sid: str = Depends(require_session)):
        return {"labels": get_arinc().label_library()}

    @app.post("/api/arinc/rx/trap")
    def api_arinc_rx_trap(body: ArincTrapBody, _sid: str = Depends(require_session)):
        arinc = get_arinc()
        bus = body.bus.upper()
        if bus not in "ABCD":
            raise HTTPException(status_code=400, detail="bus must be A-D")
        try:
            arinc.set_rx_trap(bus, body.label, body.sdi, clear=body.clear)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return arinc.snapshot()

    @app.post("/api/arinc/rx/page")
    def api_arinc_rx_page(body: ArincRxPageBody, _sid: str = Depends(require_session)):
        arinc = get_arinc()
        bus = body.bus.upper()
        if bus not in "ABCD":
            raise HTTPException(status_code=400, detail="bus must be A-D")
        arinc.set_rx_page(bus, body.page)
        return arinc.snapshot()

    @app.post("/api/arinc/time-constant")
    def api_arinc_time_constant(body: ArincTimeConstBody, _sid: str = Depends(require_session)):
        get_arinc().set_time_constant(body.seconds)
        return get_arinc().snapshot()

    @app.post("/api/arinc/channel/active")
    def api_arinc_active_channels(body: ArincActiveChannelsBody, _sid: str = Depends(require_session)):
        try:
            return get_arinc().set_active_channels(tx_ch=body.tx_ch, rx_ch=body.rx_ch)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/arinc/line")
    def api_arinc_line(body: ArincLineBody, _sid: str = Depends(require_session)):
        try:
            get_arinc().set_line(body.which, body.kind, body.bus)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return get_arinc().snapshot()

    @app.post("/api/arinc/dme/mode")
    def api_arinc_dme_mode(body: ArincDmeModeBody, _sid: str = Depends(require_session)):
        try:
            return get_arinc().apply_dme_mode(body.mode, reset=body.reset)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/arinc/dme/slot")
    def api_arinc_dme_slot(body: ArincDmeSlotBody, _sid: str = Depends(require_session)):
        try:
            return get_arinc().configure_dme_slot(
                body.index,
                bus=body.bus,
                freq_mhz=body.freq_mhz,
                mode=body.mode,
                nav=body.nav,
                disp=body.disp,
                ident=body.ident,
                sdi=body.sdi,
                ssm=body.ssm,
                pad=body.pad,
                parity=body.parity,
                rate_ms=body.rate_ms,
                enabled=body.enabled,
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/arinc/dme/handshake")
    def api_arinc_dme_handshake(body: ArincDmeHandshakeBody, _sid: str = Depends(require_session)):
        try:
            return get_arinc().dme_handshake_diagnostic(
                bus=body.bus,
                freq_mhz=body.freq_mhz,
                rate_ms=body.rate_ms,
                arm_stimulus=body.arm_stimulus,
                sim_scenario=body.sim_scenario,
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/api/arinc/hardware")
    def api_arinc_hardware(_sid: str = Depends(require_session)):
        arinc = get_arinc()
        return getattr(arinc, "hardware_info", {})

    @app.get("/api/arinc/dme/diagnostic")
    def api_arinc_dme_diagnostic(bus: str = "A", sim_scenario: str = "auto", _sid: str = Depends(require_session)):
        try:
            return get_arinc().dme_handshake_diagnostic(
                bus=bus,
                arm_stimulus=False,
                sim_scenario=sim_scenario,
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/arinc/mmr/menu")
    def api_arinc_mmr_menu(body: ArincMmrMenuBody, _sid: str = Depends(require_session)):
        try:
            return get_arinc().set_mmr_menu(body.menu)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/arinc/mmr/inc-time")
    def api_arinc_mmr_inc(body: ArincMmrIncBody, _sid: str = Depends(require_session)):
        return get_arinc().set_mmr_inc_time(body.enabled)

    @app.websocket("/ws")
    async def ws_feed(websocket: WebSocket):
        session_id = read_session_id(websocket)
        if not session_id:
            await websocket.close(code=4401)
            return
        await websocket.accept()
        try:
            while True:
                try:
                    payload = enrich_status(get_server())
                except HTTPException:
                    payload = {"error": "server not ready"}
                await websocket.send_json(payload)
                await asyncio.sleep(0.4)
        except WebSocketDisconnect:
            return
        except Exception:
            logger.exception("websocket ended")
            try:
                await websocket.close()
            except Exception:
                pass

    try:
        from features.cfds.router import router as cfds_router
        from features.cmc.router import router as cmc_router
        app.include_router(cfds_router)
        app.include_router(cmc_router)
    except Exception as exc:
        logger.warning("Could not mount cfds/cmc routers: %s", exc)

    if WEB_ROOT.is_dir():
        app.mount("/static", StaticFiles(directory=str(WEB_ROOT)), name="static")

    @app.get("/")
    def index():
        index_path = WEB_ROOT / "index.html"
        if not index_path.is_file():
            raise HTTPException(status_code=404, detail="Operator page missing")
        return FileResponse(index_path)

    @app.get("/arinc")
    def arinc_page():
        path = WEB_ROOT / "arinc.html"
        if not path.is_file():
            raise HTTPException(status_code=404, detail="ARINC page missing")
        return FileResponse(path)

    @app.get("/standard")
    def standard_page():
        path = WEB_ROOT / "arinc.html"
        if not path.is_file():
            raise HTTPException(status_code=404, detail="ARINC page missing")
        return FileResponse(path)

    @app.get("/api/arinc429/status")
    def api_arinc429_status(_sid: str = Depends(require_session)):
        return get_arinc().snapshot()

    @app.post("/api/arinc429/mode")
    def api_arinc429_mode(body: ArincModeBody, _sid: str = Depends(require_session)):
        arinc = get_arinc()
        try:
            arinc.set_mode(body.mode)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return arinc.snapshot()

    return app


# Default app for uvicorn / tests (simulation forced via env or factory).
app = create_app()
