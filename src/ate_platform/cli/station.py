"""CLI: ate-station status | estop."""

from __future__ import annotations

import argparse
import json
import logging
import sys

from ate_platform.device.server import DeviceServer
from ate_platform.paths import REPO_ROOT, load_dotenv
from ate_platform.station_model import load_station


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(prog="ate-station", description="ATE device server CLI")
    parser.add_argument(
        "--station",
        default=str(REPO_ROOT / "station" / "ni-ate.yaml"),
        help="Path to station YAML",
    )
    parser.add_argument(
        "--sim",
        action="store_true",
        help="Force simulation mode",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_status = sub.add_parser("status", help="Open instruments and print status JSON")
    p_status.add_argument("--sim", action="store_true", help="Force simulation mode")
    p_estop = sub.add_parser("estop", help="Emergency stop (outputs off, 0 V)")
    p_estop.add_argument("--sim", action="store_true", help="Force simulation mode")

    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    # Accept --sim before or after the subcommand.
    sim = bool(getattr(args, "sim", False))
    station = load_station(args.station)
    server = DeviceServer(station, simulation=True if sim else None)
    server.start()
    try:
        if args.cmd == "status":
            print(json.dumps(server.status(), indent=2))
            return 0
        if args.cmd == "estop":
            server.estop()
            print(json.dumps({"ok": True, "action": "estop"}, indent=2))
            return 0
        return 1
    finally:
        server.stop()


if __name__ == "__main__":
    sys.exit(main())
