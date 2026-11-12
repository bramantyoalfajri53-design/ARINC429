/**
 * CFDS Normal Mode Label 356 Parser & BITE Protocol Services
 * Reference: Aeroflex JcAIR T1200B Operation Manual pp. 1-4-98 to 1-4-100 (Figure 56-58)
 */

export type BurstSource = "SIMULATION" | "HARDWARE";

export interface Label356SlotWord {
  slot: number;
  label: "356";
  dataHex: string; // 6-digit hex string (24-bit payload: bits 32..9)
  desc?: string;
}

export interface ParseResult {
  valid: boolean;
  source: BurstSource;
  text: string;
  error?:
    | "NO_DATA"
    | "INCOMPLETE_DATA"
    | "INVALID_FORMAT"
    | "INVALID_STX"
    | "INVALID_EOT"
    | "BLOCK_WORD_COUNT_ERR";
  errorMessage?: string;
  expectedWordCount?: number;
  actualWordCount?: number;
}

export const FIGURE_58_TEST_BURST: Label356SlotWord[] = [
  { slot: 10, label: "356", dataHex: "02720A", desc: "STX (Block Length: 10 Words)" },
  { slot: 9, label: "356", dataHex: "202020", desc: "DATA ('   ')" },
  { slot: 8, label: "356", dataHex: "202020", desc: "DATA ('   ')" },
  { slot: 7, label: "356", dataHex: "41634A", desc: "DATA ('JcA')" },
  { slot: 6, label: "356", dataHex: "205249", desc: "DATA ('IR ')" },
  { slot: 5, label: "356", dataHex: "C3202D", desc: "DATA ('- C' + parity bit 32)" },
  { slot: 4, label: "356", dataHex: "534446", desc: "DATA ('FDS')" },
  { slot: 3, label: "356", dataHex: "455420", desc: "DATA (' TE')" },
  { slot: 2, label: "356", dataHex: "A05453", desc: "DATA ('ST ' + parity bit 32)" },
  { slot: 1, label: "356", dataHex: "040000", desc: "EOT (End of Transmission)" },
];

export const FIGURE_58_COUNT_ERR_BURST: Label356SlotWord[] = [
  { slot: 10, label: "356", dataHex: "027209", desc: "STX (Erroneous Length: 9 Words)" },
  { slot: 9, label: "356", dataHex: "202020", desc: "DATA (Word 2 of 10)" },
  { slot: 8, label: "356", dataHex: "202020", desc: "DATA (Word 3 of 10)" },
  { slot: 7, label: "356", dataHex: "41634A", desc: "DATA (Word 4 of 10)" },
  { slot: 6, label: "356", dataHex: "205249", desc: "DATA (Word 5 of 10)" },
  { slot: 5, label: "356", dataHex: "C3202D", desc: "DATA (Word 6 of 10)" },
  { slot: 4, label: "356", dataHex: "534446", desc: "DATA (Word 7 of 10)" },
  { slot: 3, label: "356", dataHex: "455420", desc: "DATA (Word 8 of 10)" },
  { slot: 2, label: "356", dataHex: "A05453", desc: "DATA (Word 9 of 10)" },
  { slot: 1, label: "356", dataHex: "040000", desc: "EOT (Word 10 of 10 - Mismatch!)" },
];

export function decodeLabel356DataWordAscii(dataHex: string): string {
  const b1 = parseInt(dataHex.slice(4, 6), 16) & 0x7f;
  const b2 = parseInt(dataHex.slice(2, 4), 16) & 0x7f;
  const b3 = parseInt(dataHex.slice(0, 2), 16) & 0x7f;
  let chars = "";
  for (const code of [b1, b2, b3]) {
    if (code >= 32 && code <= 126) {
      chars += String.fromCharCode(code);
    }
  }
  return chars;
}

export function parseLabel356Block(
  burst: Label356SlotWord[],
  source: BurstSource = "SIMULATION"
): ParseResult {
  if (!burst || burst.length === 0) {
    return { valid: false, source, text: "", error: "NO_DATA", errorMessage: "NO DATA" };
  }

  for (const item of burst) {
    if (item.label !== "356" || !/^[0-9A-Fa-f]{6}$/.test(item.dataHex)) {
      return { valid: false, source, text: "", error: "INVALID_FORMAT", errorMessage: "INVALID LABEL 356 WORD FORMAT" };
    }
  }

  if (burst.length < 3) {
    return {
      valid: false,
      source,
      text: "",
      error: "INCOMPLETE_DATA",
      errorMessage: "INCOMPLETE TRANSMISSION (<3 WORDS)",
      actualWordCount: burst.length,
    };
  }

  const stxWord = burst[0];
  const eotWord = burst[burst.length - 1];

  const stxByte = parseInt(stxWord.dataHex.slice(0, 2), 16);
  if (stxByte !== 0x02) {
    return { valid: false, source, text: "", error: "INVALID_STX", errorMessage: "INVALID STX WORD IN LABEL 356 BURST" };
  }

  const expectedCount = parseInt(stxWord.dataHex.slice(4, 6), 16);
  const actualCount = burst.length;
  if (expectedCount !== actualCount) {
    return {
      valid: false,
      source,
      text: "",
      error: "BLOCK_WORD_COUNT_ERR",
      errorMessage: "BLOCK WORD COUNT ERR",
      expectedWordCount: expectedCount,
      actualWordCount: actualCount,
    };
  }

  const eotByte = parseInt(eotWord.dataHex.slice(0, 2), 16);
  if (eotByte !== 0x04) {
    return { valid: false, source, text: "", error: "INVALID_EOT", errorMessage: "INVALID EOT WORD IN LABEL 356 BURST" };
  }

  let decoded = "";
  for (let i = 1; i < burst.length - 1; i++) {
    decoded += decodeLabel356DataWordAscii(burst[i].dataHex);
  }

  return {
    valid: true,
    source,
    text: decoded.trim(),
    actualWordCount: actualCount,
    expectedWordCount: expectedCount,
  };
}

export function getFlightPhaseCommandCode(
  phase: "GROUND" | "AIR",
  isTransition = false
): { codeHex: string; codeInt: number; description: string } {
  if (phase === "GROUND") {
    return {
      codeHex: "00",
      codeInt: 0x00,
      description: "GROUND (0x00 transmitted continuously)",
    };
  }
  if (isTransition) {
    return {
      codeHex: "12",
      codeInt: 0x12,
      description: "AIR Transition (0x12 transmitted for 100 ms)",
    };
  }
  return {
    codeHex: "11",
    codeInt: 0x11,
    description: "AIR Steady (0x11 transmitted for remainder of AIR phase)",
  };
}

