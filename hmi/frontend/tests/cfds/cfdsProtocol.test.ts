import assert from "node:assert/strict";
import {
  CFDS_LRU_TABLE,
  encodeBiteCommandWord,
  formatHex32,
  parseLabel356Block,
  FIGURE_58_TEST_BURST,
  FIGURE_58_COUNT_ERR_BURST,
  getFlightPhaseCommandCode,
  createInitialInteractiveInputState,
  beginPendingInputOp,
  applyLruAck,
  applyLruNak,
  validateDiscreteFailureRecord,
  parseDiscreteFailureBatch,
  stepFailureIndex,
} from "../../src/features/cfds/utils";
import {
  buildMenuCommandWord,
  MENU_COMMAND_MAP,
  MENU_NO_RESPONSE_3S_MSG,
  MENU_LRU_ERROR_30S_MSG,
} from "../../src/features/cfds/services/menuModeService";
import {
  INTERACTIVE_KEY_MATRIX,
  INTERACTIVE_MENU_COMMAND_MAP,
  resolveMatrixChar,
  buildInteractiveMenuCommand,
  buildInteractiveCharCommand,
  buildInteractiveClearCommand,
  buildInteractiveUnverifiedMenuKeyFrame,
} from "../../src/features/cfds/services/interactiveModeService";
import {
  DISCRETE_RX_LABEL,
  DISCRETE_TIMEOUT_1S_MS,
  DISCRETE_NO_DATA_MSG,
  getDiscreteHardwareStatus,
  getSimulatedSingleFailure,
  getSimulatedMultipleFailures,
} from "../../src/features/cfds/services/discreteModeService";

// 1. LRU Table Verification (Figure 47)
assert.equal(CFDS_LRU_TABLE.length, 19);
const tcas = CFDS_LRU_TABLE.find((l) => l.code === "735");
assert.ok(tcas && tcas.name === "TCAS");

// 2. Normal Mode ABD0018/ABD0048 & Label 227 Exact Encodings
assert.equal(
  formatHex32(encodeBiteCommandWord({ label: "227", sdi: 0, ready: false, equipmentCode: "735", commandCode: 0x00 })),
  "0x807350E9"
);
assert.equal(
  formatHex32(encodeBiteCommandWord({ label: "227", sdi: 0, ready: false, equipmentCode: "735", commandCode: 0x12 })),
  "0x927350E9"
);
assert.equal(
  formatHex32(encodeBiteCommandWord({ label: "227", sdi: 0, ready: false, equipmentCode: "735", commandCode: 0x11 })),
  "0x917350E9"
);
assert.equal(getFlightPhaseCommandCode("GROUND").codeHex, "00");
assert.equal(getFlightPhaseCommandCode("AIR", true).codeHex, "12");
assert.equal(getFlightPhaseCommandCode("AIR", false).codeHex, "11");

// 3. Normal Mode Label 356 Parser (Figure 58)
const passBurst = parseLabel356Block(FIGURE_58_TEST_BURST, "SIMULATION");
assert.equal(passBurst.valid, true);
assert.equal(passBurst.text, "JcAIR - CFDS TEST");
assert.equal(passBurst.source, "SIMULATION");

const countErr = parseLabel356Block(FIGURE_58_COUNT_ERR_BURST, "SIMULATION");
assert.equal(countErr.valid, false);
assert.equal(countErr.error, "BLOCK_WORD_COUNT_ERR");
assert.equal(countErr.errorMessage, "BLOCK WORD COUNT ERR");

// 4. Menu Mode ABD0018 (Figures 59-61)
assert.equal(Object.keys(MENU_COMMAND_MAP).length, 13);
assert.equal(MENU_COMMAND_MAP["1"].commandCode, 0x70);
assert.equal(MENU_COMMAND_MAP.PAGE.commandCode, 0x77);
assert.equal(MENU_COMMAND_MAP.F.commandCode, 0x7d);
assert.equal(buildMenuCommandWord("735", "1", 2, true).encodedHex32, "0x707356E9");
assert.equal(MENU_NO_RESPONSE_3S_MSG, "NO RESPONSE (LRU EXCEEDED 3 SECS)");
assert.equal(MENU_LRU_ERROR_30S_MSG, "LRU ERR - HIT <PRIOR PG> OR ANOTHER KEY");

// 5. Interactive Mode ABD0048 (Figures 62-70)
assert.equal(INTERACTIVE_KEY_MATRIX.length, 6);
assert.equal(INTERACTIVE_KEY_MATRIX[0].length, 7);
assert.equal(INTERACTIVE_MENU_COMMAND_MAP["3R"], 0x7a); // Manual table fix vs Fig 62 typo
assert.equal(INTERACTIVE_MENU_COMMAND_MAP.PRV, 0x76);
assert.equal(INTERACTIVE_MENU_COMMAND_MAP.NXT, 0x77);
assert.equal(buildInteractiveMenuCommand("735", "3R", 0, false).commandHex, "0x7A");
assert.equal(buildInteractiveCharCommand("735", "A", 0, false).commandHex, "0x41");
assert.equal(
  buildInteractiveClearCommand("735", false, 0, false).encodedHex32,
  "0x087350E9"
);
assert.equal(
  buildInteractiveClearCommand("735", true, 0, false).encodedHex32,
  "0x887358E9"
);
assert.equal(
  buildInteractiveClearCommand("735", false, 0, true).encodedHex32,
  "0x887354E9"
);
assert.equal(
  buildInteractiveClearCommand("735", true, 0, true).encodedHex32,
  "0x08735CE9"
);
const menuUnverified = buildInteractiveUnverifiedMenuKeyFrame();
assert.equal(menuUnverified.commandCode, null);
assert.equal(menuUnverified.commandHex, "NEEDS VERIFICATION");

const shiftCell = INTERACTIVE_KEY_MATRIX[2][3];
assert.equal(shiftCell.kind, "CHAR");
if (shiftCell.kind === "CHAR") {
  assert.equal(resolveMatrixChar(shiftCell, false), "1");
  assert.equal(resolveMatrixChar(shiftCell, true), "I");
}

// ACK / NAK handshake state machine
let iState = createInitialInteractiveInputState();
iState = beginPendingInputOp(iState, { type: "CHAR", char: "1" });
iState = applyLruNak(iState);
assert.equal(iState.handshakeStatus, "NAK_RETRY");
iState = applyLruAck(iState);
assert.equal(iState.buffer, "1");
assert.equal(iState.handshakeStatus, "ACK_DONE");

iState = beginPendingInputOp(iState, { type: "CHAR", char: "2" });
iState = applyLruNak(applyLruNak(applyLruNak(iState)));
assert.equal(iState.handshakeStatus, "NAK_MAX");
assert.equal(iState.buffer, "1");

iState = beginPendingInputOp(iState, { type: "CLR_LINE" });
iState = applyLruAck(iState);
assert.equal(iState.buffer, "");

// 6. Discrete Mode ABD0048 (Figures 71-74)
assert.equal(DISCRETE_RX_LABEL, "355");
assert.equal(DISCRETE_TIMEOUT_1S_MS, 1000);
assert.equal(DISCRETE_NO_DATA_MSG, "NO MAINTENANCE DATA RECEIVED");
assert.equal(getDiscreteHardwareStatus().connected, false);

const singleBatch = parseDiscreteFailureBatch(getSimulatedSingleFailure());
assert.equal(singleBatch.records.length, 1);
assert.equal(singleBatch.hasMultiple, false);
assert.equal(singleBatch.records[0].failureNumber, "002");

const multiBatch = parseDiscreteFailureBatch(getSimulatedMultipleFailures());
assert.equal(multiBatch.records.length, 3);
assert.equal(multiBatch.hasMultiple, true);
assert.equal(stepFailureIndex(0, multiBatch.records.length, "NEXT"), 1);
assert.equal(stepFailureIndex(0, multiBatch.records.length, "PREV"), 2);
assert.equal(stepFailureIndex(0, 1, "NEXT"), 0);

const badDiscrete = validateDiscreteFailureRecord({ failureNumber: "001" });
assert.equal(badDiscrete.valid, false);

console.log("CFDS Frontend Protocol & Parser Regression Suite: ALL ASSERTIONS PASSED");
