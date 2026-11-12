import { CFDSLayout } from "./CFDSLayout";
import "../styles/cfds.css";

function returnToModeSelect() {
  if (window.location.pathname !== "/") {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}

export function CfdsMode() {
  return (
    <div className="cfds-workbench" data-testid="cfds-workbench">
      <CFDSLayout onBackToMain={returnToModeSelect} />
    </div>
  );
}
