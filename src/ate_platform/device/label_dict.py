"""Octal-label library for RX engineering decode (Aeroflex T1200 CSV)."""

from __future__ import annotations

from typing import Any, Optional

import yaml

from ate_platform.device.arinc_encode import (
    DATA_MASK19,
    DecodedWord,
    decode_word,
    format_pads,
    label_octal_str,
    parse_label,
    ssm_name_from_bits,
)
from ate_platform.device.arinc_profile import (
    LabelSpec,
    PROFILES_DIR,
    _label_from_raw,
    decode_label,
    invalidate_labels_yaml,
    label_spec_to_dict,
)

LABELS_PATH = PROFILES_DIR / "labels.yaml"

_cache: dict[str, LabelSpec] | None = None
_cache_key: tuple[Any, ...] | None = None


def _mtime_key() -> tuple[Any, ...]:
    if LABELS_PATH.is_file():
        return (LABELS_PATH.stat().st_mtime,)
    return ()


def invalidate_label_cache() -> None:
    global _cache, _cache_key
    _cache = None
    _cache_key = None
    invalidate_labels_yaml()


def label_dictionary() -> dict[str, LabelSpec]:
    """Library only — one octal, one format. LRU YAML does not overlay RX decode."""
    global _cache, _cache_key
    key = _mtime_key()
    if _cache is not None and _cache_key == key:
        return _cache
    out: dict[str, LabelSpec] = {}
    if LABELS_PATH.is_file():
        raw = yaml.safe_load(LABELS_PATH.read_text(encoding="utf-8")) or {}
        block = raw.get("labels") or {}
        for octal, spec_raw in block.items():
            if not isinstance(spec_raw, dict):
                continue
            payload = dict(spec_raw)
            payload["label"] = str(octal).zfill(3)
            payload["source"] = "library"
            out[str(octal).zfill(3)] = _label_from_raw(payload, str(spec_raw.get("funct") or ""))
    _cache = out
    _cache_key = key
    return out


def library_catalog() -> list[dict[str, Any]]:
    """Rows for the Label Library screen (CSV order by octal)."""
    raw_block: dict[str, Any] = {}
    if LABELS_PATH.is_file():
        raw = yaml.safe_load(LABELS_PATH.read_text(encoding="utf-8")) or {}
        raw_block = raw.get("labels") or {}
    rows: list[dict[str, Any]] = []
    for octal, spec in sorted(label_dictionary().items(), key=lambda kv: int(kv[0], 8)):
        item = label_spec_to_dict(spec)
        extra = raw_block.get(octal) or {}
        item["pads"] = extra.get("pads", spec.pads)
        item["doc_page"] = extra.get("doc_page", "")
        item["name"] = spec.funct
        rows.append(item)
    return rows


def lookup_label(octal: int | str) -> Optional[LabelSpec]:
    try:
        key = label_octal_str(parse_label(octal))
    except ValueError:
        return None
    return label_dictionary().get(key)


def format_display(data19: int, eng_text: str, display_mode: str) -> str:
    dm = (display_mode or "HEX").upper()
    if dm == "BIN":
        return format(int(data19) & DATA_MASK19, "019b")
    if dm == "ENG" and eng_text:
        return eng_text
    return f"0x{int(data19) & DATA_MASK19:05X}"


def decode_received(word: int, *, display_mode: str = "ENG") -> dict[str, Any]:
    """Decode one RX word using the label library. Safe for tests."""
    decoded: DecodedWord = decode_word(int(word), profile="none")
    spec = lookup_label(decoded.label_octal)
    funct = decoded.funct
    eng_text = decoded.data_text
    eng_value: Any = None
    units = ""
    ssm_name = decoded.ssm_name
    pads = "-"
    mem = ""
    bf = ""
    extra = {}
    if spec is not None:
        try:
            eng = decode_label(spec, int(word))
            funct = spec.funct or funct
            eng_text = eng.get("data_text") or eng_text
            eng_value = eng.get("eng_value")
            units = spec.units
            extra = eng.get("extra") or {}
            mem = extra.get("mem", "")
            bf = extra.get("bf", "")
        except Exception:
            pass
        ssm_name = ssm_name_from_bits(decoded.ssm, spec.encoding, spec.ssm)
        pads = format_pads(decoded.data19, spec.pads)

    if decoded.label_octal == "202":
        if not mem:
            mem = "ON" if ((int(word) >> 10) & 1) else "OFF"
        if not bf:
            bf = "F" if ((int(word) >> 11) & 1) else "B"
        if isinstance(extra, dict):
            extra.setdefault("mem", mem)
            extra.setdefault("bf", bf)

    data_disp = format_display(decoded.data19, eng_text, display_mode)
    return {
        "label_octal": decoded.label_octal,
        "label": decoded.label,
        "sdi": decoded.sdi,
        "ssm": decoded.ssm,
        "ssm_name": ssm_name,
        "parity_odd": decoded.parity_odd,
        "raw": decoded.raw,
        "data19": decoded.data19,
        "pad3": decoded.pad3,
        "pads": pads,
        "data16": decoded.data16,
        "funct": funct,
        "data_text": eng_text,
        "data_display": data_disp,
        "eng_value": eng_value,
        "units": units,
        "encoding": spec.encoding if spec else "raw",
        "mem": mem,
        "bf": bf,
        "extra": extra,
    }
