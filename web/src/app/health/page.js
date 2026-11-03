import { getData } from "@/lib/data";
import { daysSinceDate, todayInSriLanka } from "@/lib/date";

export const dynamic = "force-dynamic";

const SOURCES = [
  ["World gold", "Yahoo Finance GC=F futures close, used as a proxy for international spot prices."],
  ["USD / LKR", "Yahoo Finance LKR=X or Central Bank of Sri Lanka market exchange rate."],
  ["Pettah 22K", "Colombo Sea Street public quotes from Ada Derana and The Morning reports."],
  ["Dealer prices", "LankaBIZZ public CSV feed. Per-row rate dates and observation times are shown separately; it is not Pettah-specific."],
];

export default function Health() {
  const health = getData("health") || {};
  const backtest = getData("backtest") || [];
  const refresh = getData("refresh") || {};
  const refreshData = refresh.data || {};
  const today = todayInSriLanka();
  const lastRun = refresh.finished_at
    ? new Date(refresh.finished_at).toLocaleString()
    : "No refresh run recorded";

  return (
    <div className="page">
      <header className="page-head">
        <p className="page-kicker">Sources &amp; validation</p>
        <h1>Data health</h1>
        <p>Review the inputs, pipeline checks, and historical model calibration.</p>
      </header>

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Feed refresh status</h2>
            <p className="section-sub">
              Daily refresh checks public market feeds; Pettah shop quotes require verification.
            </p>
          </div>
          <span className={`badge ${refresh.status === "success" ? "badge-success" : refresh.status === "failed" ? "badge-danger" : "badge-neutral"}`}>
            {refresh.status === "success" ? "Last run succeeded" : refresh.status === "failed" ? "Last run failed" : "Not yet run"}
          </span>
        </div>
        <p className="refresh-timestamp">
          Last refresh: <strong>{lastRun}</strong>
          {refresh.duration_seconds != null && ` · ${refresh.duration_seconds}s`}
        </p>
        {refresh.error && <p className="refresh-error">{refresh.error}</p>}
        <div className="refresh-grid">
          {[
            ["World gold", refreshData.world_gold],
            ["USD / LKR", refreshData.usdlkr],
            ["Pettah quotes", refreshData.pettah],
            ["Dealer prices", refreshData.dealer_quotes],
          ].map(([label, item]) => (
            <div className="source-card" key={label}>
              <strong>{label}</strong>
              <p>
                Latest date: {item?.latest_date || "not available"}
                {daysSinceDate(item?.latest_date, today) != null &&
                  ` · ${daysSinceDate(item.latest_date, today)} ${daysSinceDate(item.latest_date, today) === 1 ? "day" : "days"} old`}
              </p>
              <p>{item?.rows ?? 0} stored observations</p>
            </div>
          ))}
        </div>
        {refresh.warnings?.length > 0 && (
          <ul className="refresh-warnings" aria-label="Optional feed warnings">
            {refresh.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        )}
        {refresh.steps?.length > 0 && (
          <ul className="refresh-steps" aria-label="Refresh step results">
            {refresh.steps.map((step) => (
              <li key={step.name}>
                <span>{step.name.replaceAll("_", " ")}</span>
                <span className={`badge ${step.status === "success" ? "badge-success" : "badge-danger"}`}>
                  {step.status}
                </span>
                {step.error && <span className="refresh-step-error">{step.error}</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="section-sub" style={{ marginTop: "1rem" }}>
          Automatic scheduling requires installing the Windows Task Scheduler job from the project README.
          Feeds can fail or lag; a successful download does not guarantee a current Pettah retail price.
        </p>
      </section>

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Data sources</h2>
            <p className="section-sub">The source inventory used by the monitoring pipeline.</p>
          </div>
        </div>
        <div className="source-grid">
          {SOURCES.map(([name, description]) => (
            <article key={name} className="source-card">
              <strong>{name}</strong>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Pipeline checks</h2>
            <p className="section-sub">Latest recorded values from the data quality report.</p>
          </div>
          <span className="badge badge-info">{Object.keys(health).length} checks</span>
        </div>
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Value</th>
                <th scope="col">Review</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(health).map(([key, value]) => (
                <tr key={key}>
                  <td>{key.replaceAll("_", " ")}</td>
                  <td>{String(value)}</td>
                  <td><span className="badge badge-success">Recorded</span></td>
                </tr>
              ))}
              {Object.keys(health).length === 0 && (
                <tr><td colSpan={3}>No health report is available yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Walk-forward backtest</h2>
            <p className="section-sub">
              Kupiec calibration for the proposed model against fixed-volatility and EWMA-normal baselines.
            </p>
          </div>
          <span className="badge badge-neutral">5% / 1% tail targets</span>
        </div>
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Horizon</th>
                <th scope="col">Outside 95%</th>
                <th scope="col">Outside 99%</th>
                <th scope="col">Pinball loss</th>
                <th scope="col">Evaluation</th>
              </tr>
            </thead>
            <tbody>
              {backtest.map((row) => {
                const proposed = row.model === "model";
                return (
                  <tr key={`${row.model}-${row.horizon}`} className={proposed ? "row-highlight" : ""}>
                    <td>{proposed ? "Proposed resampling" : row.model}</td>
                    <td>{row.horizon} days</td>
                    <td>{row.outside_95 != null ? `${(row.outside_95 * 100).toFixed(1)}%` : "—"}</td>
                    <td>{row.outside_99 != null ? `${(row.outside_99 * 100).toFixed(1)}%` : "—"}</td>
                    <td>{row.pinball != null ? row.pinball.toFixed(4) : "—"}</td>
                    <td>{proposed ? "Kupiec p > 0.05" : "Baseline"}</td>
                  </tr>
                );
              })}
              {backtest.length === 0 && (
                <tr><td colSpan={6}>No backtest results are available yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="section-sub" style={{ marginTop: "1rem" }}>
          Calibration is an empirical model check, not a guarantee of future performance.
        </p>
      </section>
    </div>
  );
}
