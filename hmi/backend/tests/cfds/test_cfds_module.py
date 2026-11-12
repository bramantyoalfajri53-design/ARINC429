"""Module boundary and contract smoke tests for CFDS Mode scaffold."""

from __future__ import annotations

from features.cfds import router
from features.cfds.service import get_module_metadata


def test_cfds_module_metadata_and_router_prefix():
    meta = get_module_metadata()
    assert meta.mode == "cfds"
    assert meta.status == "scaffold"
    assert router.prefix == "/api/cfds"
