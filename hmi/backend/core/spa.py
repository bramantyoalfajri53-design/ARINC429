"""SPA static asset serving and history fallback."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_DIST


def _spa_index() -> Optional[Path]:
    index = FRONTEND_DIST / "index.html"
    return index if index.is_file() else None


def register_spa(app: FastAPI) -> None:
    """Mount built SPA assets and register the catch-all fallback route."""
    if FRONTEND_DIST.is_dir():
        assets = FRONTEND_DIST / "assets"
        if assets.is_dir():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            raise HTTPException(status_code=404)
        index = _spa_index()
        if index is None:
            return JSONResponse(
                {
                    "service": "ATE Power HMI",
                    "frontend": "not built",
                    "hint": "Run npm run build in hmi/frontend",
                }
            )
        dist_root = FRONTEND_DIST.resolve()
        requested = (dist_root / full_path).resolve()
        if full_path and requested.is_relative_to(dist_root) and requested.is_file():
            return FileResponse(requested)
        return FileResponse(index)

