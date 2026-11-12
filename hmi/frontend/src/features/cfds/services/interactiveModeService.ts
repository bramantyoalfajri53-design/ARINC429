import {
  type BiteCommandWord,
  encodeBiteCommandWord,
  formatHex32,
} from "../utils/cfdsProtocol";
import { CFDS_TIMEOUTS_MS, CFDS_VERIFIED_COMMANDS } from "../config";

/**
 * Interactive Mode (ABD0048) Service
 * Reference: Aeroflex JcAIR T1200B Operation Manual Section 4.F, Figures 62-70 (pp. 1-4-104 to 1-4-111)
 */

export type InteractiveLskKey =
  | "1L" | "2L" | "3L" | "4L" | "5L" | "6L"
  | "1R" | "2R" | "3R" | "4R" | "5R" | "6R";

export type InteractivePageKey = "NXT" | "PRV";
export type InteractiveControlKey = "MENU" | "CLR" | "SP" | "SHFT";

export interface MatrixAlphaCell {
  kind: "CHAR";
  primary: string;
  shifted?: string;
}

export type MatrixSpecialCell =
  | { kind: "LSK"; id: InteractiveLskKey; label: string; note?: string }
  | { kind: "PAGE"; id: InteractivePageKey; label: string; note?: string }
  | { kind: "CONTROL"; id: InteractiveControlKey; label: string; note?: string };

export type InteractiveMatrixCell = MatrixSpecialCell | MatrixAlphaCell;

export interface InteractiveTxFrame {
  actionLabel: string;
  commandCode: number | null; // null when NEEDS VERIFICATION (e.g. MENU)
  commandHex: string;
  bit12: boolean;
  wordSpec: BiteCommandWord | null;
  encodedWord32: number | null;
  encodedHex32: string;
  needsVerification?: string;
  timestamp: string;
}

export interface SimulatedInteractivePage {
  id: string;
  pageNumber: number;
  totalPages: number;
  mode: "MENU_LIST" | "INPUT_PROMPT";
  title: string;
  rows: Array<{
    lskLeft: string;
    leftText: string;
    lskRight: string;
    rightText: string;
  }>;
  inputPromptHeader?: string;
  inputPromptMask?: string;
  source: "SIMULATION";
}

export const INTERACTIVE_TIMEOUT_3S_MS = CFDS_TIMEOUTS_MS.INTERACTIVE_NO_RESPONSE_3S;
export const INTERACTIVE_TIMEOUT_30S_MS = CFDS_TIMEOUTS_MS.INTERACTIVE_LRU_ERROR_30S;

export const INTERACTIVE_MSG_NO_RESPONSE_BOX = "NO RESPONSE";
export const INTERACTIVE_MSG_NO_RESPONSE_PROSE = "NO RESPONSE (LRU EXCEEDED 3 SECS)";
export const INTERACTIVE_MSG_LRU_ERR_BOX = "LRU ERR - <PRIOR PG>";
export const INTERACTIVE_MSG_LRU_ERR_PROSE = "LRU ERROR - HIT <PRIOR PAGE> OR ANOTHER KEY";
export const INTERACTIVE_MSG_NAK_1 = "NAK RECEIVED";
export const INTERACTIVE_MSG_NAK_3 = "NAK RECEIVED 3 TIMES";
export const INTERACTIVE_MSG_NO_ACK_NAK = "NO ACK OR NAK RCVD";

export const INTERACTIVE_MENU_COMMAND_MAP: Record<InteractiveLskKey | InteractivePageKey, number> = {
  "1L": 0x70,
  "2L": 0x71,
  "3L": 0x72,
  "4L": 0x73,
  "5L": 0x74,
  "6L": 0x75,
  PRV: CFDS_VERIFIED_COMMANDS.PRV,
  NXT: CFDS_VERIFIED_COMMANDS.NXT,
  "1R": 0x78,
  "2R": 0x79,
  "3R": 0x7a,
  "4R": 0x7b,
  "5R": 0x7c,
  "6R": 0x7d,
};

export const INTERACTIVE_CLR_COMMAND_CODE = CFDS_VERIFIED_COMMANDS.INTERACTIVE_CLR;

export const INTERACTIVE_KEY_MATRIX: readonly (readonly InteractiveMatrixCell[])[] = [
  [
    { kind: "LSK", id: "1L", label: "1L" },
    { kind: "LSK", id: "1R", label: "1R" },
    { kind: "PAGE", id: "NXT", label: "NXT" },
    { kind: "CHAR", primary: "A" },
    { kind: "CHAR", primary: "B" },
    { kind: "CHAR", primary: "C" },
    { kind: "CHAR", primary: "D" },
  ],
  [
    { kind: "LSK", id: "2L", label: "2L" },
    { kind: "LSK", id: "2R", label: "2R" },
    { kind: "PAGE", id: "PRV", label: "PRV" },
    { kind: "CHAR", primary: "E" },
    { kind: "CHAR", primary: "F" },
    { kind: "CHAR", primary: "G" },
    { kind: "CHAR", primary: "H" },
  ],
  [
    { kind: "LSK", id: "3L", label: "3L" },
    { kind: "LSK", id: "3R", label: "3R", note: "Manual table p. 1-4-104 specifies 3R=7Ah (Fig 62-70 has typo '2R')" },
    { kind: "CONTROL", id: "MENU", label: "MENU", note: "Command code not specified in manual (NEEDS VERIFICATION)" },
    { kind: "CHAR", primary: "1", shifted: "I" },
    { kind: "CHAR", primary: "2", shifted: "J" },
    { kind: "CHAR", primary: "3", shifted: "K" },
    { kind: "CHAR", primary: ".", shifted: "L" },
  ],
  [
    { kind: "LSK", id: "4L", label: "4L" },
    { kind: "LSK", id: "4R", label: "4R" },
    { kind: "CONTROL", id: "CLR", label: "CLR" },
    { kind: "CHAR", primary: "4", shifted: "M" },
    { kind: "CHAR", primary: "5", shifted: "N" },
    { kind: "CHAR", primary: "6", shifted: "O" },
    { kind: "CHAR", primary: ",", shifted: "P" },
  ],
  [
    { kind: "LSK", id: "5L", label: "5L" },
    { kind: "LSK", id: "5R", label: "5R" },
    { kind: "CONTROL", id: "SP", label: "SP" },
    { kind: "CHAR", primary: "7", shifted: "Q" },
    { kind: "CHAR", primary: "8", shifted: "R" },
    { kind: "CHAR", primary: "9", shifted: "S" },
    { kind: "CHAR", primary: "/", shifted: "T" },
  ],
  [
    { kind: "LSK", id: "6L", label: "6L" },
    { kind: "LSK", id: "6R", label: "6R" },
    { kind: "CONTROL", id: "SHFT", label: "SHFT" },
    { kind: "CHAR", primary: "0", shifted: "U" },
    { kind: "CHAR", primary: "V", shifted: "W" },
    { kind: "CHAR", primary: "X", shifted: "Y" },
    { kind: "CHAR", primary: "-", shifted: "Z" },
  ],
];

function nowTimestamp(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

export function resolveMatrixChar(cell: MatrixAlphaCell, shiftActive: boolean): string {
  return shiftActive && cell.shifted ? cell.shifted : cell.primary;
}

function buildInteractiveFrame(
  actionLabel: string,
  equipmentCode: string,
  commandCode: number,
  sdi: number,
  ready: boolean,
  bit12: boolean
): InteractiveTxFrame {
  const wordSpec: BiteCommandWord = {
    label: "227",
    sdi,
    ready,
    bit12,
    equipmentCode,
    commandCode,
  };
  const encodedWord32 = encodeBiteCommandWord(wordSpec);
  const encodedHex32 = formatHex32(encodedWord32);
  wordSpec.rawHex = encodedHex32;

  return {
    actionLabel,
    commandCode,
    commandHex: `0x${commandCode.toString(16).toUpperCase().padStart(2, "0")}`,
    bit12,
    wordSpec,
    encodedWord32,
    encodedHex32,
    timestamp: nowTimestamp(),
  };
}

export function buildInteractiveMenuCommand(
  equipmentCode: string,
  key: InteractiveLskKey | InteractivePageKey,
  sdi = 0,
  ready = false
): InteractiveTxFrame {
  return buildInteractiveFrame(
    key,
    equipmentCode,
    INTERACTIVE_MENU_COMMAND_MAP[key],
    sdi,
    ready,
    false
  );
}

export function buildInteractiveCharCommand(
  equipmentCode: string,
  char: string,
  sdi = 0,
  ready = false
): InteractiveTxFrame {
  const ch = char.length > 0 ? char[0] : " ";
  const commandCode = ch.charCodeAt(0) & 0x7f;
  return buildInteractiveFrame(
    ch === " " ? "SP (' ')" : `CHAR '${ch}'`,
    equipmentCode,
    commandCode,
    sdi,
    ready,
    false
  );
}

export function buildInteractiveClearCommand(
  equipmentCode: string,
  isShiftClear: boolean,
  sdi = 0,
  ready = false
): InteractiveTxFrame {
  return buildInteractiveFrame(
    isShiftClear ? "SHFT + CLR (Line)" : "CLR (Char)",
    equipmentCode,
    INTERACTIVE_CLR_COMMAND_CODE,
    sdi,
    ready,
    isShiftClear
  );
}

export function buildInteractiveUnverifiedMenuKeyFrame(): InteractiveTxFrame {
  return {
    actionLabel: "MENU",
    commandCode: null,
    commandHex: "NEEDS VERIFICATION",
    bit12: false,
    wordSpec: null,
    encodedWord32: null,
    encodedHex32: "NEEDS VERIFICATION",
    needsVerification:
      "Manual Fig 62-70 displays MENU key on row 3 col 3, but Section 4.F (pp. 1-4-104 to 1-4-111) does not specify a Bits 25-31 hex code for MENU.",
    timestamp: nowTimestamp(),
  };
}

export function getSimulatedInteractivePages(
  lruName: string,
  equipmentCode: string
): SimulatedInteractivePage[] {
  return [
    {
      id: "SIM_MENU_P1",
      pageNumber: 1,
      totalPages: 2,
      mode: "MENU_LIST",
      title: `${lruName} (${equipmentCode}h) — SIM PAGE 1/2`,
      source: "SIMULATION",
      rows: [
        { lskLeft: "1L", leftText: "<LAST LEG FAULTS", lskRight: "1R", rightText: "LRU IDENT>" },
        { lskLeft: "2L", leftText: "<PREVIOUS LEGS", lskRight: "2R", rightText: "GND SCAN>" },
        { lskLeft: "3L", leftText: "<CLASS 3 FAULTS", lskRight: "3R", rightText: "INPUT TEST>" },
        { lskLeft: "4L", leftText: "<TROUBLESHOOT", lskRight: "4R", rightText: "SPECIFIC DATA>" },
        { lskLeft: "5L", leftText: "", lskRight: "5R", rightText: "" },
        { lskLeft: "6L", leftText: "<RETURN", lskRight: "6R", rightText: "" },
      ],
    },
    {
      id: "SIM_MENU_P2",
      pageNumber: 2,
      totalPages: 2,
      mode: "MENU_LIST",
      title: `${lruName} (${equipmentCode}h) — SIM PAGE 2/2`,
      source: "SIMULATION",
      rows: [
        { lskLeft: "1L", leftText: "<DISCRETE STATUS", lskRight: "1R", rightText: "PIN PROG>" },
        { lskLeft: "2L", leftText: "<CONFIG DATA", lskRight: "2R", rightText: "BITE RESET>" },
        { lskLeft: "3L", leftText: "", lskRight: "3R", rightText: "" },
        { lskLeft: "4L", leftText: "", lskRight: "4R", rightText: "" },
        { lskLeft: "5L", leftText: "", lskRight: "5R", rightText: "" },
        { lskLeft: "6L", leftText: "<RETURN", lskRight: "6R", rightText: "" },
      ],
    },
    {
      id: "SIM_INPUT_FIG65",
      pageNumber: 1,
      totalPages: 1,
      mode: "INPUT_PROMPT",
      title: "INSERT VALUE",
      inputPromptHeader: "ALT          CAS",
      inputPromptMask: "+ + + + + / + + +",
      source: "SIMULATION",
      rows: [],
    },
  ];
}

