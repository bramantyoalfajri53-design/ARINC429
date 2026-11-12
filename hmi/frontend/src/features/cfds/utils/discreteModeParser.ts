import type { DiscreteDataSource, DiscreteFailureRecord } from "../services/discreteModeService";

/**
 * Discrete Mode (ABD0048) Parser & Validation Helpers
 * Reference: Aeroflex JcAIR T1200B Manual pp. 1-4-111 to 1-4-115 (Figures 71-74)
 */

export interface DiscreteValidationResult {
  valid: boolean;
  errors: string[];
  record: DiscreteFailureRecord | null;
}

export interface DiscreteBatchParseResult {
  records: DiscreteFailureRecord[];
  invalidCount: number;
  errors: string[];
  hasMultiple: boolean;
}

const REQUIRED_FIELDS: ReadonlyArray<keyof Omit<DiscreteFailureRecord, "source" | "receivedAt">> = [
  "failureNumber",
  "failureTypeCode",
  "failureTypeString",
  "witnessPosition",
  "witnessSide",
  "suspect1Position",
  "suspect1Side",
  "suspect2Position",
  "suspect2Side",
  "suspect3Position",
  "suspect3Side",
];

function isValidCodeToken(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0 && val.trim().length <= 16;
}

export function validateDiscreteFailureRecord(
  raw: Partial<DiscreteFailureRecord> | null | undefined,
  expectedSource?: DiscreteDataSource
): DiscreteValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["Record must be a non-null object"], record: null };
  }

  const errors: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    const value = raw[field];
    if (field === "failureTypeString") {
      if (typeof value !== "string" || value.trim().length === 0) {
        errors.push(`Missing or empty field: ${field}`);
      }
    } else if (!isValidCodeToken(value)) {
      errors.push(`Invalid code token for field: ${field}`);
    }
  }

  const src: DiscreteDataSource =
    raw.source === "HARDWARE"
      ? "HARDWARE"
      : raw.source === "SIMULATION"
        ? "SIMULATION"
        : expectedSource ?? "SIMULATION";

  if (raw.source !== "HARDWARE" && raw.source !== "SIMULATION") {
    errors.push("Invalid or missing data source tag (must be HARDWARE or SIMULATION)");
  }

  if (errors.length > 0) {
    return { valid: false, errors, record: null };
  }

  return {
    valid: true,
    errors: [],
    record: {
      failureNumber: raw.failureNumber!.trim(),
      failureTypeCode: raw.failureTypeCode!.trim(),
      failureTypeString: raw.failureTypeString!.trim(),
      witnessPosition: raw.witnessPosition!.trim(),
      witnessSide: raw.witnessSide!.trim(),
      suspect1Position: raw.suspect1Position!.trim(),
      suspect1Side: raw.suspect1Side!.trim(),
      suspect2Position: raw.suspect2Position!.trim(),
      suspect2Side: raw.suspect2Side!.trim(),
      suspect3Position: raw.suspect3Position!.trim(),
      suspect3Side: raw.suspect3Side!.trim(),
      source: src,
      receivedAt: raw.receivedAt,
    },
  };
}

export function parseDiscreteFailureBatch(
  rawList: ReadonlyArray<Partial<DiscreteFailureRecord> | null | undefined>
): DiscreteBatchParseResult {
  if (!Array.isArray(rawList)) {
    return {
      records: [],
      invalidCount: 1,
      errors: ["Failure batch must be an array"],
      hasMultiple: false,
    };
  }

  const records: DiscreteFailureRecord[] = [];
  const errors: string[] = [];
  let invalidCount = 0;

  rawList.forEach((item, idx) => {
    const res = validateDiscreteFailureRecord(item);
    if (res.valid && res.record) {
      records.push(res.record);
    } else {
      invalidCount++;
      errors.push(`Record[${idx}]: ${res.errors.join("; ")}`);
    }
  });

  return {
    records,
    invalidCount,
    errors,
    hasMultiple: records.length > 1,
  };
}

export function stepFailureIndex(
  currentIndex: number,
  totalCount: number,
  direction: "PREV" | "NEXT"
): number {
  if (totalCount <= 1) return 0;
  const safeCurrent = Math.max(0, Math.min(currentIndex, totalCount - 1));
  if (direction === "NEXT") {
    return (safeCurrent + 1) % totalCount;
  }
  return (safeCurrent - 1 + totalCount) % totalCount;
}

