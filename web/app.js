(() => {
  const $ = (id) => document.getElementById(id);

  let ws = null;
  let activeRunId = null;

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
    let body = null;
    const text = await res.text();
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { detail: text };
    }
    if (!res.ok) {
      const detail = body && (body.detail || body.message) || res.statusText;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return body;
  }

  function showApp(loggedIn) {
    $("login-view").hidden = loggedIn;
    $("app-view").hidden = !loggedIn;
  }

  function fmt(n, digits = 2) {
    if (n === undefined || n === null || Number.isNaN(Number(n))) return "—";
    return Number(n).toFixed(digits);
  }

  function renderSteps(run) {
    const ol = $("steps");
    ol.innerHTML = "";
    if (!run) return;
    const done = new Map((run.steps || []).map((s) => [s.id, s]));
    const current = run.current_step_id;
    const planned = run.planned || [];
    const ids = planned.length
      ? planned.map((p) => p.id)
      : [...done.keys()];
    const names = Object.fromEntries((planned || []).map((p) => [p.id, p.name]));

    for (const id of ids) {
      const step = done.get(id);
      let verdict = "QUEUED";
      let detail = "";
      let name = names[id] || id;
      if (step) {
        verdict = step.verdict;
        name = step.name || name;
        if (step.measurements && step.measurements.voltage !== undefined) {
          detail = `${fmt(step.measurements.voltage)} V`;
        } else if (step.measurements && step.measurements.v_rms !== undefined) {
          detail = `${fmt(step.measurements.v_rms)} Vrms`;
        } else if (step.detail) {
          detail = String(step.detail).split("\n")[0].slice(0, 48);
        }
      } else if (id === current) {
        verdict = "RUNNING";
      }
      const li = document.createElement("li");
      li.innerHTML = `<span class="v-${verdict}">${verdict}</span><span>${name}</span><span class="muted">${detail}</span>`;
      ol.appendChild(li);
    }
  }

  function applyStatus(data) {
    if (!data || data.error) return;
    $("station-id").textContent = data.station_id || "—";
    const sim = !!(data.dc && data.dc.simulation) || !!(data.ac && data.ac.simulation);
    const badge = $("mode-badge");
    badge.textContent = sim ? "SIM" : "LXI";
    badge.className = "badge " + (sim ? "sim" : "hw");

    const lock = data.lock || {};
    $("lock-label").textContent = lock.held
      ? ` · lock: ${lock.label || "held"}`
      : " · lock: idle";

    const dcM = (data.dc && data.dc.measure) || {};
    const acM = (data.ac && data.ac.measure) || {};
    $("dc-v").textContent = fmt(dcM.voltage);
    $("dc-i").textContent = fmt(dcM.current, 3);
    $("dc-out").textContent = dcM.output_on ? "ON" : "OFF";
    $("ac-v").textContent = fmt(acM.v_rms);
    $("ac-hz").textContent = fmt(acM.frequency, 1);
    $("ac-out").textContent = acM.output_on ? "ON" : "OFF";

    const run = data.run || {};
    activeRunId = run.active ? run.run_id : null;
    $("btn-start").disabled = !!run.active || !!lock.held;
    $("btn-abort").disabled = !run.active;
    if (run.active) {
      $("run-status").textContent = `Running ${run.plan_id || ""} (${run.run_id})`;
    } else if (run.verdict) {
      $("run-status").textContent = `Last: ${run.verdict} · ${run.run_id || ""}`;
    } else {
      $("run-status").textContent = "Idle";
    }
    renderSteps(run);
  }

  async function refreshRuns() {
    const data = await api("/api/runs");
    const tbody = $("runs-table").querySelector("tbody");
    tbody.innerHTML = "";
    for (const r of data.recent || []) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.run_id}</td><td>${r.plan_id || ""}</td><td>${r.uut_id || ""}</td><td>${r.verdict || ""}</td>`;
      tr.addEventListener("click", async () => {
        const detail = await api(`/api/runs/${encodeURIComponent(r.run_id)}`);
        const pre = $("run-detail");
        pre.hidden = false;
        pre.textContent = JSON.stringify(detail, null, 2);
      });
      tbody.appendChild(tr);
    }
  }

  async function loadPlans() {
    const data = await api("/api/plans");
    const sel = $("plan");
    sel.innerHTML = "";
    for (const p of data.plans || []) {
      const opt = document.createElement("option");
      opt.value = p.path;
      opt.textContent = p.name;
      sel.appendChild(opt);
    }
  }

  function connectWs() {
    if (ws) {
      try { ws.close(); } catch {}
    }
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onmessage = (ev) => {
      try {
        applyStatus(JSON.parse(ev.data));
      } catch {}
    };
    ws.onclose = () => {
      setTimeout(() => {
        if (!$("app-view").hidden) connectWs();
      }, 1500);
    };
  }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("login-error").hidden = true;
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ pin: $("pin").value }),
      });
      showApp(true);
      await loadPlans();
      await refreshRuns();
      connectWs();
    } catch (err) {
      $("login-error").textContent = err.message;
      $("login-error").hidden = false;
    }
  });

  $("btn-logout").addEventListener("click", async () => {
    try { await api("/api/auth/logout", { method: "POST", body: "{}" }); } catch {}
    if (ws) try { ws.close(); } catch {}
    showApp(false);
  });

  $("btn-estop").addEventListener("click", async () => {
    try {
      await api("/api/estop", { method: "POST", body: "{}" });
    } catch (err) {
      alert(err.message);
    }
  });

  $("run-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/runs", {
        method: "POST",
        body: JSON.stringify({
          plan: $("plan").value,
          operator: $("operator").value,
          uut_id: $("uut").value,
          adapter_id: $("adapter").value,
        }),
      });
      setTimeout(refreshRuns, 1200);
    } catch (err) {
      alert(err.message);
    }
  });

  $("btn-abort").addEventListener("click", async () => {
    if (!activeRunId) return;
    try {
      await api(`/api/runs/${encodeURIComponent(activeRunId)}/abort`, {
        method: "POST",
        body: "{}",
      });
    } catch (err) {
      alert(err.message);
    }
  });

  // Resume session if cookie still valid.
  api("/api/auth/session")
    .then(async () => {
      showApp(true);
      await loadPlans();
      await refreshRuns();
      connectWs();
    })
    .catch(() => showApp(false));
})();
