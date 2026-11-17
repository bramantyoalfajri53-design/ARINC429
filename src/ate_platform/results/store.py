"""JSON run result store."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ate_platform.paths import REPO_ROOT


def plan_hash(plan_path: Path) -> str:
    data = plan_path.read_bytes()
    return hashlib.sha256(data).hexdigest()[:16]


def new_run_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{stamp}-{uuid.uuid4().hex[:8]}"


def write_run(record: dict[str, Any], out_dir: Path | None = None) -> Path:
    directory = out_dir or (REPO_ROOT / "results_out")
    directory.mkdir(parents=True, exist_ok=True)
    run_id = record.get("run_id") or new_run_id()
    path = directory / f"{run_id}.json"
    path.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def list_runs(out_dir: Path | None = None, *, limit: int = 50) -> list[dict[str, Any]]:
    directory = out_dir or (REPO_ROOT / "results_out")
    if not directory.is_dir():
        return []
    paths = sorted(directory.glob("*.json"), key=lambda p: p.name, reverse=True)
    summaries: list[dict[str, Any]] = []
    for path in paths[:limit]:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        summaries.append(
            {
                "run_id": data.get("run_id", path.stem),
                "verdict": data.get("verdict"),
                "operator": data.get("operator"),
                "uut_id": data.get("uut_id"),
                "adapter_id": data.get("adapter_id"),
                "plan_id": data.get("plan_id"),
                "result_path": str(path),
            }
        )
    return summaries


def load_run(run_id: str, out_dir: Path | None = None) -> dict[str, Any] | None:
    directory = out_dir or (REPO_ROOT / "results_out")
    path = directory / f"{run_id}.json"
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    data["result_path"] = str(path)
    return data
