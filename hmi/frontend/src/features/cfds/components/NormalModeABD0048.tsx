import type { FC } from "react";
import type { CfdsLruItem } from "../utils/lruDefinitions";
import type { CfdsTxParameters } from "../utils/cfdsDefaults";
import { NormalModeView } from "./NormalModeView";

export interface NormalModeABD0048Props {
  selectedLru: CfdsLruItem;
  txParams: CfdsTxParameters;
  onBack: () => void;
  onEmitBiteCommand?: (cmd: { commandCode: number; sdi?: number; ready?: boolean; actionLabel?: string }) => void;
  onSimulateNormal?: (scenario: "FIGURE_58_PASS" | "COUNT_ERROR" | "CLEAR") => void;
}

/**
 * Normal Mode ABD0048 Component
 * Functions identically to Normal Mode (ABD0018) per Manual Page 1-4-103.
 * Reference: Aeroflex JcAIR T1200B Manual Figure 56-58, Page 1-4-103.
 */
export const NormalModeABD0048: FC<NormalModeABD0048Props> = (props) => {
  return <NormalModeView standard="ABD0048" {...props} />;
};

