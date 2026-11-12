import type { FC } from "react";
import type { CfdsLruItem } from "../../utils/lruDefinitions";
import type { CfdsTxParameters } from "../../utils/cfdsDefaults";
import { MenuModeView } from "./MenuModeView";

export interface MenuModeABD0018Props {
  selectedLru: CfdsLruItem;
  txParams: CfdsTxParameters;
  onBack: () => void;
  onEmitBiteCommand?: (cmd: { commandCode: number; sdi?: number; ready?: boolean; actionLabel?: string }) => void;
}

/**
 * Menu Mode (ABD0018) Component
 * Reference: Aeroflex JcAIR T1200B Operation Manual Figures 59-61 (pp. 1-4-101 to 1-4-103).
 */
export const MenuModeABD0018: FC<MenuModeABD0018Props> = (props) => {
  return <MenuModeView {...props} />;
};

