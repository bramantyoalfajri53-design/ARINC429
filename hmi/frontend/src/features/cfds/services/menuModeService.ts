import {
  type BiteCommandWord,
  encodeBiteCommandWord,
  formatHex32,
} from "../utils/cfdsProtocol";
import { CFDS_TIMEOUTS_MS } from "../config";

/**
 * Menu Mode (ABD0018) Service
 * Reference: Aeroflex JcAIR T1200B Operation Manual Section 4.F, Figures 59-61 (pp. 1-4-101 to 1-4-103)
 */

export type MenuLeftKeyId = "1" | "2" | "3" | "4" | "5" | "6";
export type MenuRightKeyId = "A" | "B" | "C" | "D" | "E" | "F";
export type MenuKeyId = MenuLeftKeyId | MenuRightKeyId | "PAGE";

export type MenuDisplayStatus =
  | "WAITING"
  | "TIMEOUT_3S"
  | "TIMEOUT_30S"
  | "SIM_DATA_ACTIVE";

export interface MenuCommandDef {
  key: MenuKeyId;
  side: "LEFT" | "RIGHT" | "PAGE_BELOW_F";
  commandCode: number;
  hexLabel: string;
  description: string;
}

export interface MenuTxFrame {
  key: MenuKeyId;
  commandCode: number;
  commandHex: string;
  wordSpec: BiteCommandWord;
  encodedWord32: number;
  encodedHex32: string;
  timestamp: string;
}

export interface SimulatedMenuRow {
  leftKey: MenuLeftKeyId;
  leftText: string;
  rightKey: MenuRightKeyId;
  rightText: string;
}

export interface SimulatedMenuPage {
  pageNumber: number;
  totalPages: number;
  title: string;
  rows: SimulatedMenuRow[];
  hasNextPage: boolean;
  source: "SIMULATION";
}

export const MENU_TIMEOUT_3S_MS = CFDS_TIMEOUTS_MS.MENU_NO_RESPONSE_3S;
export const MENU_TIMEOUT_30S_MS = CFDS_TIMEOUTS_MS.MENU_LRU_ERROR_30S;

export const MENU_NO_RESPONSE_3S_MSG = "NO RESPONSE (LRU EXCEEDED 3 SECS)";
export const MENU_LRU_ERROR_30S_MSG = "LRU ERR - HIT <PRIOR PG> OR ANOTHER KEY";
export const MENU_LRU_ERROR_30S_PROSE = "LRU ERROR - HIT <PRIOR PAGE> OR ANOTHER KEY";

export const MENU_LEFT_KEYS: readonly MenuCommandDef[] = [
  { key: "1", side: "LEFT", commandCode: 0x70, hexLabel: "70", description: "Menu Item 1" },
  { key: "2", side: "LEFT", commandCode: 0x71, hexLabel: "71", description: "Menu Item 2" },
  { key: "3", side: "LEFT", commandCode: 0x72, hexLabel: "72", description: "Menu Item 3" },
  { key: "4", side: "LEFT", commandCode: 0x73, hexLabel: "73", description: "Menu Item 4" },
  { key: "5", side: "LEFT", commandCode: 0x74, hexLabel: "74", description: "Menu Item 5" },
  { key: "6", side: "LEFT", commandCode: 0x75, hexLabel: "75", description: "Menu Item 6" },
];

export const MENU_RIGHT_KEYS: readonly MenuCommandDef[] = [
  { key: "A", side: "RIGHT", commandCode: 0x78, hexLabel: "78", description: "Menu Item A" },
  { key: "B", side: "RIGHT", commandCode: 0x79, hexLabel: "79", description: "Menu Item B" },
  { key: "C", side: "RIGHT", commandCode: 0x7a, hexLabel: "7A", description: "Menu Item C" },
  { key: "D", side: "RIGHT", commandCode: 0x7b, hexLabel: "7B", description: "Menu Item D" },
  { key: "E", side: "RIGHT", commandCode: 0x7c, hexLabel: "7C", description: "Menu Item E" },
  { key: "F", side: "RIGHT", commandCode: 0x7d, hexLabel: "7D", description: "Menu Item F" },
];

export const MENU_PAGE_KEY: MenuCommandDef = {
  key: "PAGE",
  side: "PAGE_BELOW_F",
  commandCode: 0x77,
  hexLabel: "77",
  description: "Next Menu Page (NXT reverse video)",
};

export const MENU_COMMAND_MAP: Record<MenuKeyId, MenuCommandDef> = {
  "1": MENU_LEFT_KEYS[0],
  "2": MENU_LEFT_KEYS[1],
  "3": MENU_LEFT_KEYS[2],
  "4": MENU_LEFT_KEYS[3],
  "5": MENU_LEFT_KEYS[4],
  "6": MENU_LEFT_KEYS[5],
  A: MENU_RIGHT_KEYS[0],
  B: MENU_RIGHT_KEYS[1],
  C: MENU_RIGHT_KEYS[2],
  D: MENU_RIGHT_KEYS[3],
  E: MENU_RIGHT_KEYS[4],
  F: MENU_RIGHT_KEYS[5],
  PAGE: MENU_PAGE_KEY,
};

export function buildMenuCommandWord(
  equipmentCode: string,
  key: MenuKeyId,
  sdi = 0,
  ready = false
): MenuTxFrame {
  const def = MENU_COMMAND_MAP[key];
  const wordSpec: BiteCommandWord = {
    label: "227",
    sdi,
    ready,
    equipmentCode,
    commandCode: def.commandCode,
  };
  const encodedWord32 = encodeBiteCommandWord(wordSpec);
  const encodedHex32 = formatHex32(encodedWord32);
  wordSpec.rawHex = encodedHex32;

  return {
    key,
    commandCode: def.commandCode,
    commandHex: `0x${def.hexLabel}`,
    wordSpec,
    encodedWord32,
    encodedHex32,
    timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
  };
}

export function getSimulatedMenuPages(lruName: string, equipmentCode: string): SimulatedMenuPage[] {
  return [
    {
      pageNumber: 1,
      totalPages: 2,
      title: `${lruName} (${equipmentCode}h) — SIM MENU PAGE 1/2`,
      hasNextPage: true,
      source: "SIMULATION",
      rows: [
        { leftKey: "1", leftText: "<LAST LEG REPORT", rightKey: "A", rightText: "LRU IDENT>" },
        { leftKey: "2", leftText: "<PREVIOUS LEGS", rightKey: "B", rightText: "GROUND SCAN>" },
        { leftKey: "3", leftText: "<CLASS 3 FAULTS", rightKey: "C", rightText: "SYSTEM TEST>" },
        { leftKey: "4", leftText: "<TROUBLE SHOOT", rightKey: "D", rightText: "SPECIFIC DATA>" },
        { leftKey: "5", leftText: "", rightKey: "E", rightText: "" },
        { leftKey: "6", leftText: "<RETURN", rightKey: "F", rightText: "" },
      ],
    },
    {
      pageNumber: 2,
      totalPages: 2,
      title: `${lruName} (${equipmentCode}h) — SIM MENU PAGE 2/2`,
      hasNextPage: true,
      source: "SIMULATION",
      rows: [
        { leftKey: "1", leftText: "<DISCRETE STATUS", rightKey: "A", rightText: "PIN PROGRAM>" },
        { leftKey: "2", leftText: "<MAINT CONFIG", rightKey: "B", rightText: "BITE RESET>" },
        { leftKey: "3", leftText: "", rightKey: "C", rightText: "" },
        { leftKey: "4", leftText: "", rightKey: "D", rightText: "" },
        { leftKey: "5", leftText: "", rightKey: "E", rightText: "" },
        { leftKey: "6", leftText: "<RETURN", rightKey: "F", rightText: "" },
      ],
    },
  ];
}

