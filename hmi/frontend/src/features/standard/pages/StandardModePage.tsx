import { ArincStandardMode } from "../components/ArincStandardModeView";

export function StandardModePage() {
  return (
    <div className="module-page-container">
      <div className="module-page-header">
        <div>
          <h2>AEROFLEX JCAIR T1200 / T1200B — STANDARD MODE</h2>
          <p className="section-sub">
            Configure TX/RX channels, edit words, and test avionics LRUs.
          </p>
        </div>
      </div>
      <ArincStandardMode />
    </div>
  );
}
