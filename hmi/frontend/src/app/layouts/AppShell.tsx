import { useEffect, useState, type ReactNode } from "react";
import {
  arincApi,
  ConfirmModal,
  useAppSession,
  type ArincBusSpeed,
  type ArincDataSource,
} from "../../shared";
import { OPERATING_MODES } from "../configuration";
import { navigateToRoute } from "../router";

function getCurrentPath(): string {
  return window.location.pathname || "/";
}

export function AppShell({ children }: { children: ReactNode }) {
  const { logout, confirm, confirmHv, cancelHv } = useAppSession();
  const [currentPath, setCurrentPath] = useState<string>(getCurrentPath);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [busSpeed, setBusSpeed] = useState<ArincBusSpeed>("12.5k");
  const [dataSource, setDataSource] = useState<ArincDataSource>("SIMULATION");

  useEffect(() => {
    const onPopState = () => setCurrentPath(getCurrentPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let active = true;
    const syncStatus = async () => {
      try {
        const snap = await arincApi.fetchStatus();
        if (!active) return;
        setIsRunning(snap.bus_running);
        setBusSpeed(snap.global_speed);
        setDataSource(snap.source);
      } catch {
        // Ignore transient poll errors while unauthenticated or starting up
      }
    };
    void syncStatus();
    const timer = window.setInterval(() => void syncStatus(), 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const handleNav = async (path: string) => {
    navigateToRoute(path);
    setCurrentPath(path);
    if (path === "/standard") {
      await arincApi.acquireMode("STANDARD").catch(() => undefined);
    } else if (path === "/cfds") {
      await arincApi.acquireMode("CFDS").catch(() => undefined);
    } else if (path === "/cmc") {
      await arincApi.acquireMode("CMC").catch(() => undefined);
    }
  };

  const handleBusStartStop = async (running: boolean) => {
    setIsRunning(running);
    try {
      const snap = await arincApi.updateBus({ running });
      setIsRunning(snap.bus_running);
      setDataSource(snap.source);
    } catch {
      // Keep UI responsive if API unreachable
    }
  };

  const handleToggleSpeed = async () => {
    const next: ArincBusSpeed = busSpeed === "12.5k" ? "100k" : "12.5k";
    setBusSpeed(next);
    try {
      const snap = await arincApi.updateBus({ speed: next });
      setBusSpeed(snap.global_speed);
    } catch {
      // Keep UI responsive
    }
  };

  const currentMode = OPERATING_MODES.find((m) => m.path === currentPath);
  const modeSubtitle = currentPath === "/" ? "Mode Select" : (currentMode?.label || "Console");

  return (
    <div className="app">
      {/* Topbar: Clean Light Theme matching user's reference design */}
      <header className="app-topbar">
        <div className="brand-section" onClick={() => void handleNav("/")}>
          <span className="brand-title">
            ATE <span className="teal-text">429</span>
          </span>
          <span className="brand-subtitle">{modeSubtitle}</span>
        </div>

        <div className="topbar-actions">
          <span
            className={dataSource === "HARDWARE" ? "badge-hw" : "badge-sim"}
            title={
              dataSource === "HARDWARE"
                ? "Connected to Ballard OmniBus II Hardware"
                : "Simulated Mode — Data is tagged SIMULATION and not from physical LRU"
            }
          >
            {dataSource}
          </span>
          <span className={isRunning ? "badge-running" : "badge-stopped"}>
            {isRunning ? "RUNNING" : "STOPPED"}
          </span>
          <button
            type="button"
            className="badge-speed"
            onClick={() => void handleToggleSpeed()}
            title="Click to toggle global ARINC 429 bitrate (12.5 kbps / 100 kbps)"
          >
            {busSpeed === "100k" ? "100 kbps" : "12.5 kbps"}
          </button>
          <button
            type="button"
            className="btn-start"
            onClick={() => void handleBusStartStop(true)}
            title="Start ARINC 429 Bus Transmission"
          >
            Start
          </button>
          <button
            type="button"
            className="btn-stop"
            onClick={() => void handleBusStartStop(false)}
            title="Stop ARINC 429 Bus Transmission"
          >
            Stop
          </button>
          <a
            href={arincApi.exportUrl("csv")}
            className="btn-logout"
            style={{ textDecoration: "none" }}
            title="Export ARINC 429 session logs (CSV)"
          >
            Export CSV
          </a>
          <span className="operator-label">Operator</span>
          <button
            type="button"
            className="btn-logout"
            onClick={logout}
            title="Sign out of current session"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Sub-nav quick switcher when inside any mode */}
      {currentPath !== "/" && (
        <nav className="sub-nav-strip">
          <button
            type="button"
            className="sub-nav-btn"
            onClick={() => void handleNav("/")}
          >
            &larr; Mode Select
          </button>
          <span style={{ color: "var(--border-color)" }}>|</span>
          <button
            type="button"
            className={`sub-nav-btn ${currentPath === "/standard" ? "active" : ""}`}
            onClick={() => void handleNav("/standard")}
          >
            Standard Mode
          </button>
          <button
            type="button"
            className={`sub-nav-btn ${currentPath === "/cfds" ? "active" : ""}`}
            onClick={() => void handleNav("/cfds")}
          >
            CFDS Mode
          </button>
          <button
            type="button"
            className={`sub-nav-btn ${currentPath === "/cmc" ? "active" : ""}`}
            onClick={() => void handleNav("/cmc")}
          >
            CMC Mode
          </button>
          <button
            type="button"
            className={`sub-nav-btn ${currentPath === "/library" ? "active" : ""}`}
            onClick={() => void handleNav("/library")}
          >
            Label Library
          </button>
          <button
            type="button"
            className={`sub-nav-btn ${currentPath === "/power" ? "active" : ""}`}
            onClick={() => void handleNav("/power")}
          >
            ATE Power Console
          </button>
        </nav>
      )}

      {/* Viewport */}
      <main className="app-content">{children}</main>

      {confirm ? (
        <ConfirmModal
          title="High voltage confirmation"
          message={confirm.message ?? "Confirm enabling high voltage output?"}
          onCancel={cancelHv}
          onConfirm={confirmHv}
        />
      ) : null}
    </div>
  );
}
