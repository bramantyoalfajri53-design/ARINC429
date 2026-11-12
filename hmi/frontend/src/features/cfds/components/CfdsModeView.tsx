import { CFDS_MODE_CONFIG } from "../config";

export function CfdsMode() {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>AEROFLEX JCAIR T1200 / T1200B — {CFDS_MODE_CONFIG.label.toUpperCase()}</h2>
        <span className="pill view">READY FOR DEVELOPMENT</span>
      </div>
      <p className="section-sub">
        Modul CFDS dikosongkan sesuai pembagian tim agar siap dikembangkan secara independen pada direktori <code>features/cfds/</code>.
      </p>
    </section>
  );
}
