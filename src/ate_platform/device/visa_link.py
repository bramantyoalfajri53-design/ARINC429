"""Resolve VISA resources over LXI (LAN) or GPIB."""

from __future__ import annotations

import logging
from typing import Iterable, Optional

logger = logging.getLogger("ate_platform.visa")

try:
    import pyvisa

    VISA_AVAILABLE = True
except ImportError:
    pyvisa = None  # type: ignore
    VISA_AVAILABLE = False


def is_socket_resource(resource_name: str) -> bool:
    return "::SOCKET" in resource_name.upper()


def apply_visa_session(inst, resource_name: str, timeout_ms: int = 4000) -> None:
    inst.timeout = timeout_ms
    if is_socket_resource(resource_name):
        inst.write_termination = "\n"
        inst.read_termination = "\n"


def lxi_resource_candidates(host: str) -> list[str]:
    host = (host or "").strip()
    if not host:
        return []
    return [
        f"TCPIP0::{host}::hislip0::INSTR",
        f"TCPIP0::{host}::inst0::INSTR",
        f"TCPIP0::{host}::5025::SOCKET",
    ]


def resource_candidates(
    *,
    explicit: str = "",
    lxi_host: str = "",
    gpib_fallback: str = "",
) -> list[str]:
    out: list[str] = []
    for item in (explicit, *lxi_resource_candidates(lxi_host), gpib_fallback):
        item = (item or "").strip()
        if item and item not in out:
            out.append(item)
    return out


def _try_idn(rm, resource: str) -> Optional[str]:
    inst = None
    try:
        inst = rm.open_resource(resource, timeout=1500)
        apply_visa_session(inst, resource, timeout_ms=1500)
        return inst.query("*IDN?").strip()
    except Exception:
        return None
    finally:
        if inst is not None:
            try:
                inst.close()
            except Exception:
                pass


def _iter_listed(rm, patterns: Iterable[str]) -> list[str]:
    found: list[str] = []
    for pattern in patterns:
        try:
            for res in rm.list_resources(pattern):
                if "INTFC" in res:
                    continue
                if res not in found:
                    found.append(res)
        except Exception:
            pass
    return found


def detect_instrument(
    model_keyword: str,
    *,
    explicit: str = "",
    lxi_host: str = "",
    gpib_fallback: str = "",
) -> str:
    preferred = resource_candidates(
        explicit=explicit, lxi_host=lxi_host, gpib_fallback=gpib_fallback
    )
    if not VISA_AVAILABLE:
        return preferred[0] if preferred else gpib_fallback

    rm = pyvisa.ResourceManager()
    tried: set[str] = set()

    def consider(resource: str) -> Optional[str]:
        if not resource or resource in tried:
            return None
        tried.add(resource)
        idn = _try_idn(rm, resource)
        if idn and model_keyword.upper() in idn.upper():
            logger.info("[AUTO-DETECT] %s at %s (%s)", model_keyword, resource, idn)
            return resource
        return None

    for resource in preferred:
        hit = consider(resource)
        if hit:
            return hit
    for resource in _iter_listed(rm, ("TCPIP?*", "GPIB?*")):
        hit = consider(resource)
        if hit:
            return hit

    fallback = preferred[0] if preferred else gpib_fallback
    logger.warning("No match for %s; using %s", model_keyword, fallback)
    return fallback
