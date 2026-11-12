import { CmcMode } from "../components/CmcModeView";

export function CmcModePage() {
  return (
    <div className="module-page-container">
      <div className="module-page-header">
        <div>
          <h2>AEROFLEX JCAIR T1200 / T1200B — CMC MODE</h2>
          <p className="section-sub">
            Boeing Central Maintenance Computer (D243W201-1 / ARINC 604-1).
          </p>
        </div>
      </div>
      <CmcMode />
    </div>
  );
}
