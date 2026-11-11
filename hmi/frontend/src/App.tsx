import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, telemetryWsUrl } from "./api";
import type { HvConfirmDetail, TelemetryFrame } from "./types";

const DC_PRESETS = [
  { label: "28V Aircraft", voltage: 28 },
  { label: "12V", voltage: 12 },
  { label: "5V", voltage: 5 },
  { label: "3.3V", voltage: 3.3 },
  { label: "0V Off", voltage: 0 },
];

const AC_PRESETS = [
  { label: "115V@400Hz", voltage: 115, frequency: 400 },
  { label: "230V@50Hz", voltage: 230, frequency: 50 },
  { label: "115V@60Hz", voltage: 115, frequency: 60 },
  { label: "26V@400Hz", voltage: 26, frequency: 400 },
  { label: "0V Off", voltage: 0, frequency: 400 },
];

type ChartSeries = { color: string; values: number[] };

function StripChart({ series, height = 96 }: { series: ChartSeries[]; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#05080c";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (const s of series) {
      if (s.values.length < 2) continue;
      const max = Math.max(...s.values, 0.01);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      s.values.forEach((v, i) => {
        const x = (i / Math.max(s.values.length - 1, 1)) * (w - 2) + 1;
        const y = h - 4 - (v / max) * (h - 8);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [series, height]);
  return <canvas ref={canvasRef} className="stripchart" width={520} height={height} />;
}

function SetpointInput(props: {
  value: number;
  disabled: boolean;
  step: string;
  min: number;
  max: number;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(String(props.value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(props.value));
  }, [props.value]);
  return (
    <input
      type="number"
      step={props.step}
      min={props.min}
      max={props.max}
      disabled={props.disabled}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(ev) => setText(ev.target.value)}
      onBlur={() => {
        focused.current = false;
        const n = Number(text);
        if (!Number.isNaN(n)) props.onCommit(n);
      }}
    />
  );
}

function Meter({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="meter">
      <div className="meter-label">{label}</div>
      <div className="meter-value">
        {value}
        <span className="meter-unit">{unit}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [frame, setFrame] = useState<TelemetryFrame | null>(null);
  const [confirm, setConfirm] = useState<HvConfirmDetail | null>(null);
  const [pendingOutput, setPendingOutput] = useState<null | { kind: "dc" | "ac"; enabled: boolean }>(null);
  const [status, setStatus] = useState("");
  const canControl = Boolean(frame?.lease.you_control);

  const dcVHist = useRef<number[]>([]);
  const dcIHist = useRef<number[]>([]);
  const acVHist = useRef<number[]>([]);
  const acPHist = useRef<number[]>([]);

  const pushHist = (buf: number[], v: number) => {
    buf.push(v);
    if (buf.length > 100) buf.shift();
  };

  const checkSession = useCallback(async () => {
    try {
      await api("/api/auth/session");
      setAuthed(true);
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (!authed) return;
    let ws: WebSocket | null = null;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      ws = new WebSocket(telemetryWsUrl());
      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data) as TelemetryFrame;
        if (data.error) return;
        pushHist(dcVHist.current, data.dc?.voltage ?? 0);
        pushHist(dcIHist.current, data.dc?.current ?? 0);
        pushHist(acVHist.current, data.ac?.v_rms ?? 0);
        pushHist(acPHist.current, data.ac?.power_watts ?? 0);
        setFrame(data);
      };
      ws.onclose = () => {
        if (!stopped) setTimeout(connect, 1000);
      };
    };
    connect();
    return () => {
      stopped = true;
      ws?.close();
    };
  }, [authed]);

  useEffect(() => {
    if (!canControl) return;
    const id = window.setInterval(() => {
      void api("/api/control/heartbeat", { method: "POST", body: "{}" }).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(id);
  }, [canControl]);

  const command = async (path: string, body: unknown) => {
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      setStatus("");
    } catch (err) {
      const e = err as Error & { hv?: HvConfirmDetail };
      if (e.hv) {
        setConfirm(e.hv);
        return;
      }
      setStatus(e.message);
    }
  };

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ pin }) });
      setAuthed(true);
      setPin("");
    } catch (err) {
      setLoginError((err as Error).message);
    }
  };

  const dcCharts = useMemo(
    () => [
      { color: "#00f0ff", values: [...dcVHist.current] },
      { color: "#f59e0b", values: [...dcIHist.current] },
    ],
    [frame],
  );
  const acCharts = useMemo(
    () => [
      { color: "#38bdf8", values: [...acVHist.current] },
      { color: "#10b981", values: [...acPHist.current] },
    ],
    [frame],
  );

  if (!authed) {
    return (
      <div className="login-wrap">
        <form className="login-card" onSubmit={onLogin}>
          <div className="kicker">ATE POWER HMI</div>
          <h1>Operator sign-in</h1>
          <p>LAN console for Keysight N5746A DCPS and AC6803B ACPS. PIN required.</p>
          <label>
            PIN
            <input
              type="password"
              value={pin}
              onChange={(ev) => setPin(ev.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </label>
          {loginError ? <div className="error">{loginError}</div> : null}
          <button type="submit">Enter console</button>
        </form>
      </div>
    );
  }

  const dc = frame?.dc;
  const ac = frame?.ac;
  const lease = frame?.lease;

  const requestOutput = (kind: "dc" | "ac", enabled: boolean) => {
    setPendingOutput({ kind, enabled });
    void command(kind === "dc" ? "/api/dc/output" : "/api/ac/output", {
      enabled,
      confirm_high_voltage: false,
    });
  };

  const confirmHv = () => {
    if (!pendingOutput) {
      setConfirm(null);
      return;
    }
    const path = pendingOutput.kind === "dc" ? "/api/dc/output" : "/api/ac/output";
    void command(path, { enabled: pendingOutput.enabled, confirm_high_voltage: true });
    setConfirm(null);
    setPendingOutput(null);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <strong>ATE POWER CONTROL CONSOLE</strong>
          <span className="muted">Keysight N5746A &amp; AC6803B</span>
        </div>
        <div className="top-actions">
          <span className={frame?.simulation ? "pill sim" : "pill ok"}>
            {frame?.simulation ? "SIM MODE" : "LIVE"}
          </span>
          <span className={canControl ? "pill ok" : "pill view"}>
            {canControl ? "CONTROL" : lease?.held ? "VIEW ONLY" : "NO CONTROL"}
          </span>
          {canControl ? (
            <>
              <label className="sim-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(frame?.simulation)}
                  onChange={(ev) => command("/api/mode/simulation", { enabled: ev.target.checked })}
                />
                Sim
              </label>
              <button type="button" onClick={() => command("/api/gpib/rescan", {})}>
                Re-Scan
              </button>
              <button type="button" onClick={() => command("/api/control/release", {})}>
                Release
              </button>
            </>
          ) : (
            <button type="button" className="primary" onClick={() => command("/api/control/acquire", {})}>
              Take control
            </button>
          )}
          <button type="button" className="estop" onClick={() => command("/api/estop", {})}>
            E-STOP
          </button>
          <button
            type="button"
            onClick={() => {
              void api("/api/auth/logout", { method: "POST", body: "{}" });
              setAuthed(false);
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {status ? <div className="banner">{status}</div> : null}
      {!canControl ? (
        <div className="banner view">Read-only session. Setpoints and output are disabled. E-STOP remains available.</div>
      ) : null}

      <main className="panels">
        <section className="panel">
          <h2>N5746A — DC POWER SUPPLY 40V / 19A</h2>
          <div className="panel-head">
            <span className={dc?.fault ? "pill fault" : dc?.output_on ? "pill ok" : "pill"}>
              {dc?.fault ? dc.fault_msg : dc?.output_on ? "OUTPUT ON" : "STANDBY"}
            </span>
            {canControl ? (
              <button
                type="button"
                className={dc?.output_on ? "power on" : "power"}
                onClick={() => requestOutput("dc", !dc?.output_on)}
              >
                {dc?.output_on ? "DC OFF" : "DC ON"}
              </button>
            ) : null}
          </div>
          <div className="meters">
            <Meter label="Measured Voltage" value={(dc?.voltage ?? 0).toFixed(2)} unit="V" />
            <Meter label="Measured Current" value={(dc?.current ?? 0).toFixed(3)} unit="A" />
            <Meter label="Calculated Power" value={(dc?.power ?? 0).toFixed(1)} unit="W" />
            <Meter label="Regulation" value={dc?.status ?? "--"} unit="" />
          </div>
          <label>
            Target voltage (0–40 V)
            <SetpointInput
              value={dc?.set_voltage ?? 0}
              disabled={!canControl}
              step="0.5"
              min={0}
              max={40}
              onCommit={(n) => command("/api/dc/setpoint", { voltage: n })}
            />
          </label>
          <label>
            Current limit (0–19 A)
            <SetpointInput
              value={dc?.set_current ?? 0}
              disabled={!canControl}
              step="0.5"
              min={0}
              max={19}
              onCommit={(n) => command("/api/dc/setpoint", { current: n })}
            />
          </label>
          <label>
            Hardware OVP (1–45 V)
            <SetpointInput
              value={dc?.set_ovp ?? 35}
              disabled={!canControl}
              step="1"
              min={1}
              max={45}
              onCommit={(n) => command("/api/dc/setpoint", { ovp: n })}
            />
          </label>
          <div className="presets">
            {DC_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={!canControl}
                onClick={() => command("/api/dc/preset", { voltage: p.voltage })}
              >
                {p.label}
              </button>
            ))}
          </div>
          <StripChart series={dcCharts} />
          <div className="idn">{dc?.idn}</div>
        </section>

        <section className="panel">
          <h2>AC6803B — AC POWER SOURCE 2 kVA</h2>
          <div className="panel-head">
            <span className={ac?.fault ? "pill fault" : ac?.output_on ? "pill ok" : "pill"}>
              {ac?.fault ? ac.fault_msg : ac?.output_on ? "OUTPUT ON" : "STANDBY"}
            </span>
            {canControl ? (
              <button
                type="button"
                className={ac?.output_on ? "power on" : "power"}
                onClick={() => requestOutput("ac", !ac?.output_on)}
              >
                {ac?.output_on ? "AC OFF" : "AC ON"}
              </button>
            ) : null}
          </div>
          <div className="meters">
            <Meter label="Measured Vrms" value={(ac?.v_rms ?? 0).toFixed(1)} unit="Vrms" />
            <Meter label="Measured Irms" value={(ac?.i_rms ?? 0).toFixed(2)} unit="Arms" />
            <Meter label="Active Power" value={(ac?.power_watts ?? 0).toFixed(1)} unit="W" />
            <Meter
              label="Freq / PF"
              value={`${(ac?.frequency ?? 0).toFixed(0)} / ${(ac?.power_factor ?? 1).toFixed(2)}`}
              unit=""
            />
          </div>
          <label>
            Target voltage (0–270 Vrms)
            <SetpointInput
              value={ac?.set_voltage ?? 0}
              disabled={!canControl}
              step="1"
              min={0}
              max={270}
              onCommit={(n) => command("/api/ac/setpoint", { voltage: n })}
            />
          </label>
          <label>
            Frequency (45–500 Hz)
            <SetpointInput
              value={ac?.set_frequency ?? 400}
              disabled={!canControl}
              step="5"
              min={45}
              max={500}
              onCommit={(n) => command("/api/ac/setpoint", { frequency: n })}
            />
          </label>
          <label>
            Current limit (0–20 Arms)
            <SetpointInput
              value={ac?.set_current ?? 10}
              disabled={!canControl}
              step="0.5"
              min={0}
              max={20}
              onCommit={(n) => command("/api/ac/setpoint", { current: n })}
            />
          </label>
          <div className="presets">
            {AC_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={!canControl}
                onClick={() => command("/api/ac/preset", { voltage: p.voltage, frequency: p.frequency })}
              >
                {p.label}
              </button>
            ))}
          </div>
          <StripChart series={acCharts} />
          <div className="idn">{ac?.idn}</div>
        </section>
      </main>

      <footer className="log">
        <strong>LOG</strong>
        <pre>
          {(frame?.log || [])
            .slice(-12)
            .map((l) => `[${l.ts}] [${l.level}] ${l.message}`)
            .join("\n")}
        </pre>
      </footer>

      {confirm ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>High voltage confirmation</h3>
            <p>{confirm.message}</p>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setConfirm(null);
                  setPendingOutput(null);
                }}
              >
                Cancel
              </button>
              <button type="button" className="primary" onClick={confirmHv}>
                Confirm enable
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
