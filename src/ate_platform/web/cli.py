"""CLI: ate-web — operator UI daemon."""

from __future__ import annotations

import argparse
import logging
import os
import sys

from ate_platform.paths import load_dotenv


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(prog="ate-web", description="ATE operator UI daemon")
    parser.add_argument("--sim", action="store_true", help="Force simulation")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    if args.sim:
        os.environ["ATE_FORCE_SIM"] = "1"

    import uvicorn

    from ate_platform.web.app import create_app

    app = create_app(simulation=True if args.sim else None)
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
