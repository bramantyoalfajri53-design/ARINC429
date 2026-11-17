"""Limit helpers shared by sequencer and TPS plugins."""

from __future__ import annotations


class LimitError(AssertionError):
    pass


def expect_v(actual: float, nominal: float, tol: float, *, name: str = "V") -> None:
    lo, hi = nominal - tol, nominal + tol
    if not (lo <= actual <= hi):
        raise LimitError(f"{name}={actual:.4f} outside {nominal}±{tol} ([{lo}, {hi}])")


def expect_hz(actual: float, nominal: float, tol: float, *, name: str = "Hz") -> None:
    expect_v(actual, nominal, tol, name=name)
