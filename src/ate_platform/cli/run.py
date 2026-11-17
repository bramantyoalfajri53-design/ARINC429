"""CLI: ate-run <plan.yaml>."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from ate_platform.paths import REPO_ROOT, load_dotenv
from ate_platform.sequencer.runner import run_plan


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(prog="ate-run", description="Run an ATE test plan")
    parser.add_argument("plan", help="Path to plan YAML")
    parser.add_argument(
        "--station",
        default=str(REPO_ROOT / "station" / "ni-ate.yaml"),
    )
    parser.add_argument("--sim", action="store_true", help="Force simulation")
    parser.add_argument("--operator", default="operator")
    parser.add_argument("--uut", default="DUMMY-UUT")
    parser.add_argument("--adapter", default="dummy_ita")
    parser.add_argument(
        "--out-dir",
        default=str(REPO_ROOT / "results_out"),
        help="Directory for JSON run records",
    )
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    record = run_plan(
        args.plan,
        station_path=args.station,
        simulation=True if args.sim else None,
        operator=args.operator,
        uut_id=args.uut,
        adapter_id=args.adapter,
        out_dir=Path(args.out_dir),
    )
    print(json.dumps(record, indent=2))
    return 0 if record.get("verdict") == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
