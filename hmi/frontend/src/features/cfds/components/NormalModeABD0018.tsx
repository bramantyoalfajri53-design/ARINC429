import type { FC } from "react";
import type { CfdsLruItem } from "../utils/lruDefinitions";
import type { CfdsTxParameters } from "../utils/cfdsDefaults";
import { NormalModeView } from "./NormalModeView";

export interface NormalModeABD0018Props {
  selectedLru: CfdsLruItem;
  txParams: CfdsTxParameters;
  onBack: () => void;
  onEmitBiteCommand?: (cmd: { commandCode: number; sdi?: number; ready?: boolean; actionLabel?: string }) => void;
  onSimulateNormal?: (scenario: "FIGURE_58_PASS" | "COUNT_ERROR" | "CLEAR") => void;
}

/**
 * Normal Mode ABD0018 Component
 * Reference: Aeroflex JcAIR T1200B Manual Figure 56-58 (pp. 1-4-98 to 1-4-100).
 */
export const NormalModeABD0018: FC<NormalModeABD0018Props> = (props) => {
  return <NormalModeView standard="ABD0018" {...props} />;
};

