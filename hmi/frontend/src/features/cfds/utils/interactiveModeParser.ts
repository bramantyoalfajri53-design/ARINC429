/**
 * Interactive Mode (ABD0048) Handshake & Input State Helpers
 * Reference: Aeroflex JcAIR T1200B Operation Manual pp. 1-4-107 to 1-4-111 (Figures 65-70)
 */

export type InteractivePendingOp =
  | { type: "CHAR"; char: string }
  | { type: "CLR_CHAR" }
  | { type: "CLR_LINE" };

export type InteractiveHandshakeStatus =
  | "IDLE"
  | "AWAITING_ACK_NAK"
  | "ACK_DONE"
  | "NAK_RETRY"
  | "NAK_MAX"
  | "NO_ACK_NAK_3S"
  | "LRU_ERR_30S";

export interface InteractiveInputState {
  buffer: string;
  pendingOp: InteractivePendingOp | null;
  pendingEchoChar: string;
  nakCount: number;
  handshakeStatus: InteractiveHandshakeStatus;
}

export function createInitialInteractiveInputState(): InteractiveInputState {
  return {
    buffer: "",
    pendingOp: null,
    pendingEchoChar: "",
    nakCount: 0,
    handshakeStatus: "IDLE",
  };
}

export function beginPendingInputOp(
  state: InteractiveInputState,
  op: InteractivePendingOp
): InteractiveInputState {
  const echoChar =
    op.type === "CHAR"
      ? op.char
      : state.pendingEchoChar || state.buffer.slice(-1);

  return {
    ...state,
    pendingOp: op,
    pendingEchoChar: echoChar,
    nakCount: 0,
    handshakeStatus: "AWAITING_ACK_NAK",
  };
}

export function applyLruAck(state: InteractiveInputState): InteractiveInputState {
  if (!state.pendingOp) return state;

  let nextBuffer = state.buffer;
  if (state.pendingOp.type === "CHAR") {
    nextBuffer = state.buffer + state.pendingOp.char;
  } else if (state.pendingOp.type === "CLR_CHAR") {
    nextBuffer = state.buffer.length > 0 ? state.buffer.slice(0, -1) : "";
  } else if (state.pendingOp.type === "CLR_LINE") {
    nextBuffer = "";
  }

  return {
    buffer: nextBuffer,
    pendingOp: null,
    pendingEchoChar: "",
    nakCount: 0,
    handshakeStatus: "ACK_DONE",
  };
}

export function applyLruNak(state: InteractiveInputState): InteractiveInputState {
  if (!state.pendingOp) return state;

  const nextNak = state.nakCount + 1;
  if (nextNak >= 3) {
    return {
      ...state,
      pendingOp: null,
      nakCount: 3,
      handshakeStatus: "NAK_MAX",
    };
  }

  return {
    ...state,
    nakCount: nextNak,
    handshakeStatus: "NAK_RETRY",
  };
}

