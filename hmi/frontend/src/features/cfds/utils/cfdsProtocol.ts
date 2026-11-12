/**
 * CFDS ARINC 429 Protocol Services
 * Reference: Aeroflex JcAIR T1200B Manual Section 4.F (pp. 1-4-85 - 1-4-115)
 *
 * BITE Command Word (Label 227):
 * - Bits 1-8:   Label 227 (octal -> wire reversed 0xE9)
 * - Bits 9-10:  SDI (Source/Destination Identifier)
 * - Bit 11:     Ready / Spare
 * - Bit 12:     Spare (1 for SHFT+CLR / 0 for CLR in Interactive Mode)
 * - Bits 13-24: Hexadecimal Equipment Code (12-bit)
 * - Bits 25-31: Command Code (7-bit)
 * - Bit 32:     Parity (Odd)
 */

export interface BiteCommandWord {
  label: "227";
  sdi: number;
  ready: boolean;
  bit12?: boolean;
  equipmentCode: string;
  commandCode: number;
  rawHex?: string;
}

export function computeOddParity(val31: number): number {
  let count = 0;
  for (let i = 0; i < 31; i++) {
    if ((val31 >>> i) & 1) count++;
  }
  return count % 2 === 0 ? 1 : 0;
}

export function encodeBiteCommandWord(cmd: BiteCommandWord): number {
  const labelVal = 0xE9; // Octal 227 bit-reversed on ARINC 429 wire
  const sdiVal = (cmd.sdi & 0x03) << 8;
  const readyVal = (cmd.ready ? 1 : 0) << 10;
  const bit12Val = (cmd.bit12 ? 1 : 0) << 11;
  const eqCodeVal = (parseInt(cmd.equipmentCode, 16) & 0xFFF) << 12;
  const cmdVal = (cmd.commandCode & 0x7F) << 24;

  const word31 = (labelVal | sdiVal | readyVal | bit12Val | eqCodeVal | cmdVal) >>> 0;
  const parity = computeOddParity(word31);
  return (word31 | (parity << 31)) >>> 0;
}

export function formatHex32(val: number): string {
  return "0x" + (val >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

