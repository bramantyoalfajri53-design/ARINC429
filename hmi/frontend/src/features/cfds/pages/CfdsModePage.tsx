import { CfdsMode } from "../components/CfdsModeView";

export function CfdsModePage() {
  return (
    <div className="module-page-container">
      <div className="module-page-header">
        <div>
          <h2>AEROFLEX JCAIR T1200 / T1200B — CFDS / CSDS MODE</h2>
          <p className="section-sub">
            Airbus Centralized Fault Display System (ABD0018 / ABD0048).
          </p>
        </div>
      </div>
      <CfdsMode />
    </div>
  );
}
