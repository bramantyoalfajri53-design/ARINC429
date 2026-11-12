import type { FC } from "react";
import type { CfdsLruItem } from "../../utils/lruDefinitions";
import type { CfdsTxParameters } from "../../utils/cfdsDefaults";
import { InteractiveModeView } from "./InteractiveModeView";

export interface InteractiveModeABD0048Props {
  selectedLru: CfdsLruItem;
  txParams: CfdsTxParameters;
  onBack: () => void;
  onEmitBiteCommand?: (cmd: { commandCode: number; sdi?: number; ready?: boolean; bit12?: boolean; actionLabel?: string }) => void;
}

/**
 * Interactive Mode (ABD0048) Component
 * Reference: Aeroflex JcAIR T1200B Operation Manual Figures 62-70 (pp. 1-4-104 to 1-4-111).
 */
export const InteractiveModeABD0048: FC<InteractiveModeABD0048Props> = (props) => {
  return <InteractiveModeView {...props} />;
};

