import type { FC } from "react";
import type { CfdsLruItem } from "../../utils/lruDefinitions";
import type { CfdsTxParameters } from "../../utils/cfdsDefaults";
import { DiscreteModeView } from "./DiscreteModeView";

export interface DiscreteModeABD0048Props {
  selectedLru: CfdsLruItem;
  txParams: CfdsTxParameters;
  onBack: () => void;
  onSimulateDiscrete?: (scenario: "SINGLE_FIG73" | "MULTI_FIG74" | "CLEAR") => void;
}

/**
 * Discrete Mode (ABD0048) Component
 * Reference: Aeroflex JcAIR T1200B Operation Manual Figures 71-74 (pp. 1-4-111 to 1-4-115).
 */
export const DiscreteModeABD0048: FC<DiscreteModeABD0048Props> = (props) => {
  return <DiscreteModeView {...props} />;
};

