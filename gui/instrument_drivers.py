"""
Compatibility wrapper: desktop HMI still imports `instrument_drivers`.
Implementation lives in hmi/backend/ate_power/drivers.py.
"""

import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent / "hmi" / "backend"
_backend_str = str(_BACKEND)
if _backend_str not in sys.path:
    sys.path.insert(0, _backend_str)

from ate_power.drivers import (  # noqa: E402
    ACSourceDriver,
    DCSupplyDriver,
    VISA_AVAILABLE,
    auto_detect_gpib_instrument,
)

__all__ = [
    "ACSourceDriver",
    "DCSupplyDriver",
    "VISA_AVAILABLE",
    "auto_detect_gpib_instrument",
]
