# CFDS REST API Documentation

**Base Prefix:** `/api/cfds`  
**Authentication:** Required on all endpoints (`Depends(require_session)` using HTTP session cookie from `POST /api/auth/login`). Unauthenticated requests return `401 Unauthorized`.

---

## 1. Endpoints Summary

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cfds/status` | Returns CFDS module metadata (`mode`, `status`, `standards`). |
| `GET` | `/api/cfds/state` | Returns full CFDS runtime state, coordinator `source`, bus/channel snapshot, TX params, last TX word, and RX buffers. |
| `POST` | `/api/cfds/lru` | Acquires `CFDS` coordinator mode and sets the target LRU (`code`, `name`, `description`). |
| `POST` | `/api/cfds/tx-params` | Updates TX parameters (`date`, `time`, `flightNumber`, `cityPairs`, `aircraftId`, `flightPhase` 0–12) and optional 17-bit `aircraftConfig`. |
| `POST` | `/api/cfds/command` | Encodes Label `227` BITE Command Word via `core.arinc429.encode_arinc429_word`, transmits on the selected TX channel, and returns updated state + `tx_word`. |
| `POST` | `/api/cfds/normal/simulate` | Injects (`FIGURE_58_PASS`, `COUNT_ERROR`) or clears (`CLEAR`) Normal Mode Label `356` bursts tagged `source: "SIMULATION"`. |
| `POST` | `/api/cfds/discrete/simulate` | Injects (`SINGLE_FIG73`, `MULTI_FIG74`) or clears (`CLEAR`) Discrete Mode Label `355` failure records tagged `source: "SIMULATION"`. |
| `POST` | `/api/cfds/channels/configure` | Configures shared ARINC 429 channel (`TX-A..D` or `RX-A..D`) speed, enable flag, or trap label via `arinc_coordinator`. |

---

## 2. Verified Request / Response Examples

### `GET /api/cfds/status`
```json
{
  "mode": "cfds",
  "status": "active",
  "standards": ["ABD0018", "ABD0048"]
}
```

### `POST /api/cfds/command`
**Request (`Normal Mode AIR Transition 0x12` for TCAS `735`):**
```json
{
  "equipment_code": "735",
  "command_code": 18,
  "sdi": 0,
  "ready": false,
  "bit12": false,
  "channel": "TX-A",
  "submode": "NORMAL",
  "action_label": "AIR_TRANSITION"
}
```
**Key Response Fields:**
- `source`: `"SIMULATION"` (or `"HARDWARE"` if connected)
- `last_tx_command.raw_hex`: `"0x927350E9"`
- `tx_word.raw_hex`: `"927350E9"`
- `tx_word.label`: `"227"`

### Validation & Error Status Codes
- `401 Unauthorized`: Missing or expired session cookie.
- `400 Bad Request`: Unknown ARINC channel or invalid bus operation.
- `422 Unprocessable Entity`: Invalid Pydantic input (e.g., non-hex `equipment_code`, out-of-range `flightPhase`, invalid channel ID).
