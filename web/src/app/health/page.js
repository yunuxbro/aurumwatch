import { getData } from "@/lib/data";
import { lkr } from "@/lib/format";
import { daysSinceDate, todayInSriLanka } from "@/lib/date";

export const dynamic = "force-dynamic";

const SOURCES = [
  ["World gold", "Yahoo Finance GC=F futures closes (proxy, not spot)."],
  ["USD / LKR", "Yahoo Finance LKR=X daily closes; cross-checked against CBSL's indicative USD/LKR spot series via Macro Lab (CBSL Data Library plus CBSL exchange-rate lookup pages)."],
  ["CBSL gold reference", "CBSL indicative XAU/LKR daily table, fetched through AllRatesToday and refreshed hourly; a link to the provider is shown with the rate."],
  ["Pettah 22K", "14 archived Colombo Sea Street quotes from Ada Derana and The Morning; newest is 2026-05-06. Search through 2026-11-05 found no qualifying Oct-Nov 2026 quote to add."],
  ["Dealer prices", "Public Sri Lankan dealer feed. Per-row rate dates and observation times are shown separately; it is not Pettah-specific."],
];

export default function Health() {
  const health = getData("health") || {};
  const backtest = getData("backtest") || [];
  const backtestRegime = getData("backtest_regime") || [];
  const fxAudit = getData("fx_audit") || {};
  const refresh = getData("refresh") || {};
  const forecast = getData("ml_forecast") || {};
  const market = getData("market_reference") || {};
  const forecastIsCurrent = forecast.status === "available"
    && refresh.status === "success"
    && refresh.steps?.some((step) => step.name === "market_model" && step.status === "success")
    && forecast.market_as_of_date === market.gold_date
    && forecast.market_as_of_date === market.fx_date;
  const refreshData = refresh.data || {};
  const today = todayInSriLanka();
  const lastRun = refresh.finished_at
    ? new Date(refresh.finished_at).toLocaleString()
    : "No refresh run recorded";
  const freshness = (item, sourceType) => {
    if (item?.freshness?.status) return item.freshness;
    const age = daysSinceDate(item?.latest_date, today);
    if (age == null) return { status: "unavailable", working_days_old: null };
    const observed = new Date(`${item.latest_date}T00:00:00Z`);
    const current = new Date(`${today}T00:00:00Z`);
    let weekdays = 0;
    for (let day = new Date(observed); day < current; day.setUTCDate(day.getUTCDate() + 1)) {
      const weekday = day.getUTCDay();
      if (weekday !== 0 && weekday !== 6) weekdays += 1;
    }
    const limit = sourceType === "dealer" ? 3 : sourceType === "pettah" ? 3 : 5;
    return { status: weekdays > limit ? "stale" : "current", working_days_old: weekdays };
  };

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
            ["World gold", refreshData.world_gold, "gold"],
            ["USD / LKR", refreshData.usdlkr, "fx"],
            ["Pettah quotes", refreshData.pettah, "pettah"],
            ["Dealer prices", refreshData.dealer_quotes, "dealer"],
          ].map(([label, item, sourceType]) => {
            const state = freshness(item, sourceType);
            return (
            <div className="source-card" key={label}>
              <strong>{label}</strong>
              <p>
                Latest date: {item?.latest_date || "not available"}
                {daysSinceDate(item?.latest_date, today) != null &&
                  ` · ${daysSinceDate(item.latest_date, today)} ${daysSinceDate(item.latest_date, today) === 1 ? "day" : "days"} old`}
              </p>
              <p>{item?.rows ?? 0} stored observations</p>
              {item?.source && <p>Source: {item.source}</p>}
              <span className={`badge ${state.status === "current" ? "badge-success" : state.status === "stale" ? "badge-warning" : "badge-neutral"}`}>
                {state.status}
                {state.working_days_old != null && ` · ${state.working_days_old} working days old`}
              </span>
            </div>
          );})}
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
          Scheduled refresh runs through GitHub Actions at 12:00 Colombo time; each successful source update is committed and triggers the Vercel deployment.
          Feeds can fail or lag; a successful download does not guarantee a current Pettah retail price.
        </p>
      </section>

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Supervised market model</h2>
            <p className="section-sub">
              Standardized ridge regression predicts the next 7 joined gold/FX market observations for a synthetic 22K benchmark.
              It does not predict Pettah or individual shop prices.
            </p>
          </div>
          <span className={`badge ${forecastIsCurrent ? "badge-info" : "badge-warning"}`}>
            {forecastIsCurrent ? `Current · ${forecast.market_as_of_date}` : forecast.status === "available" ? `Stale · ${forecast.market_as_of_date}` : "Unavailable"}
          </span>
        </div>
        {forecast.status === "available" ? (
          <>
            <p className="section-sub">
              Training / validation / holdout: {forecast.evaluation.train_samples} / {forecast.evaluation.validation_samples} / {forecast.evaluation.test_samples} samples.
              Chronological holdout: {forecast.evaluation.test_start_date} to {forecast.evaluation.test_end_date}; alpha selected on validation.
              Standardization was fit on training data only, and the 7-observation target was purged at split boundaries.
            </p>
            <div className="forecast-metrics">
              <div>
                <p className="k">Ridge 7-observation forecast · 22K / 8 g</p>
                <p className="v">{lkr(forecast.forecast_lkr_per_8g)}</p>
              </div>
              <div>
                <p className="k">Predicted benchmark change</p>
                <p className="v">{forecast.forecast_change_percent >= 0 ? "+" : ""}{forecast.forecast_change_percent.toFixed(2)}%</p>
              </div>
            </div>
            <div className="scroll-x" style={{ marginTop: "1rem" }}>
              <table className="data-table">
                <thead>
                  <tr><th scope="col">Holdout metric</th><th scope="col">Ridge model</th><th scope="col">No-change baseline</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>MAE (basis points)</td>
                    <td>{forecast.test_metrics.ridge.mae_bps.toFixed(2)}</td>
                    <td>{forecast.test_metrics.no_change_baseline.mae_bps.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>RMSE (basis points)</td>
                    <td>{forecast.test_metrics.ridge.rmse_bps.toFixed(2)}</td>
                    <td>{forecast.test_metrics.no_change_baseline.rmse_bps.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Directional accuracy</td>
                    <td>{(forecast.test_metrics.ridge.directional_accuracy * 100).toFixed(1)}%</td>
                    <td>Not meaningful for a zero-return prediction</td>
                  </tr>
                </tbody>
              </table>
            </div>
              <p className="section-sub" style={{ marginTop: "0.75rem" }}>
              Paired block-bootstrap 95% CI for ridge-minus-baseline MAE: [
              {forecast.test_metrics.paired_block_bootstrap_95ci_mae_difference_bps.map((value) => value.toFixed(2)).join(", ")}] bps.
              {forecast.test_metrics.ridge_beats_baseline_mae
                ? " Ridge had lower holdout MAE in this evaluation; this is not evidence of future performance."
                : " Ridge did not beat the no-change MAE baseline on this holdout; treat it as an experimental demonstration, not a validated improvement."}
            </p>
            <p className="section-sub">
              Most influential standardized coefficients: {forecast.feature_weights.slice(0, 5).map((item) => item.feature.replaceAll("_", " ")).join(", ")}.
              These ridge coefficients are the model explanation; SHAP is not used.
            </p>
          </>
        ) : (
          <p className="refresh-error">{forecast.error || "No trained forecast is available. The model refresh failed or there is not enough valid market history."}</p>
        )}
      </section>

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Data sources</h2>
            <p className="section-sub">
              The source inventory used by the monitoring pipeline. See the full licence and collection notes in{" "}
              <a href="https://github.com/yunuxbro/aurumwatch/blob/main/DATA_SOURCES.md" target="_blank" rel="noreferrer">DATA_SOURCES.md</a>.
            </p>
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
        <p className="section-sub" style={{ marginTop: "1rem" }}>
          Full-history FX comparison checked {fxAudit.checked_at || "date unavailable"} against the <a href={fxAudit.reference_url || "https://macrolab.lk/data/series/LK.EXT.FX.USD.SPOT.D/"} target="_blank" rel="noreferrer">CBSL indicative series via Macro Lab</a> through {fxAudit.reference_as_of || "date unavailable"}. Across {fxAudit.matched_dates ?? "—"} matched dates, the median absolute level gap is {Number(fxAudit.absolute_level_gap_median_pct ?? 0).toFixed(2)}%, p95 {Number(fxAudit.absolute_level_gap_p95_pct ?? 0).toFixed(2)}%, and max {Number(fxAudit.absolute_level_gap_max_pct ?? 0).toFixed(2)}%. Daily log-return correlation is {Number(fxAudit.daily_log_return_correlation ?? 0).toFixed(3)}. {fxAudit.return_difference_over_threshold_dates ?? "—"} dates differ by more than 100 bps in daily log returns. {fxAudit.return_difference_spike_overlap_count ?? "—"} of {fxAudit.existing_spike_flag_dates?.length ?? "—"} current spike-flag dates overlap: {fxAudit.return_difference_spike_overlap_dates?.join(", ") || "none"}. The series do not track closely enough to treat as interchangeable. This comparison identifies dates for review; it does not prove which provider is wrong. The three recent CBSL overrides apply only to 2-4 Nov 2026. Macro Lab charts/text are CC BY 4.0; CBSL reuse rights for the underlying values have not been independently verified. See DATA_SOURCES.md for method and terms.
        </p>
        <details className="section-sub" style={{ marginTop: ".5rem" }}>
          <summary>Show all {fxAudit.return_difference_over_threshold_dates ?? 0} dates with daily return differences over 100 bps</summary>
          <div className="scroll-x" style={{ maxHeight: "24rem", overflow: "auto", marginTop: ".75rem" }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Yahoo return</th><th>CBSL return</th><th>Absolute difference</th><th>Spike flag</th></tr></thead>
              <tbody>
                {(fxAudit.return_difference_dates || []).map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td><td>{row.yahoo_return_pct.toFixed(2)}%</td>
                    <td>{row.cbsl_return_pct.toFixed(2)}%</td><td>{row.absolute_difference_bps.toFixed(1)} bps</td>
                    <td>{row.overlaps_spike_flag ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="section-sub"><a href="/data/fx_return_discrepancies.csv" download>Download the complete return-difference date list (CSV)</a>. {fxAudit.yahoo_dates_without_cbsl_observation ?? "—"} Yahoo dates have no CBSL observation. Only the three recent overrides use CBSL values in the app; the remaining history is not represented as CBSL-verified.</p>
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
              Calibration, interval width, and pinball loss for the joint gold/FX resampling model and two baselines.
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
                <th scope="col">Windows</th>
                <th scope="col">Outside 95%</th>
                <th scope="col">95% width</th>
                <th scope="col">Outside 99%</th>
                <th scope="col">Kupiec p · 95%</th>
                <th scope="col">Kupiec p · 99%</th>
                <th scope="col">Pinball loss</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              {backtest.map((row) => {
                const proposed = row.model === "model";
                return (
                  <tr key={`${row.model}-${row.horizon}`} className={proposed ? "row-highlight" : ""}>
                    <td>{proposed ? "Proposed resampling" : row.model === "B1_fixed_vol" ? "Fixed volatility" : "Normal / EWMA"}</td>
                    <td>{row.horizon} days</td>
                    <td>{row.n ?? "—"}</td>
                    <td>{row.outside_95 != null ? `${(row.outside_95 * 100).toFixed(1)}%` : "—"}</td>
                    <td>{row.width_95 != null ? `${(row.width_95 * 100).toFixed(1)}%` : "—"}</td>
                    <td>{row.outside_99 != null ? `${(row.outside_99 * 100).toFixed(1)}%` : "—"}</td>
                    <td>{row.kupiec_p_95 != null ? row.kupiec_p_95.toFixed(3) : "—"}</td>
                    <td>{row.kupiec_p_99 != null ? row.kupiec_p_99.toFixed(3) : "—"}</td>
                    <td>{row.pinball != null ? row.pinball.toFixed(4) : "—"}</td>
                    <td>{proposed ? "Resampling model" : "Baseline"}</td>
                  </tr>
                );
              })}
              {backtest.length === 0 && (
                <tr><td colSpan={10}>No backtest results are available yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="section-sub" style={{ marginTop: "1rem" }}>
          The proposed model matches the baselines on calibration and pinball loss in this sample. It adds joint gold/FX resampling and current-volatility scaling, but these results do not prove it is better. Width is the mean 95% log-return interval as a percentage.
        </p>
        <h3 className="section-title" style={{ marginTop: "1.25rem" }}>Jan–Mar 2026 high-volatility window check</h3>
        <p className="section-sub">
          Forecast endpoints in Jan–Mar only. This is a small stress slice, not an independent proof of regime performance.
        </p>
        <div className="scroll-x">
          <table className="data-table">
            <thead><tr><th>Model</th><th>Horizon</th><th>Windows</th><th>Outside 95%</th><th>Mean 95% width</th></tr></thead>
            <tbody>
              {backtestRegime.map((row) => (
                <tr key={`${row.model}-${row.horizon}`}>
                  <td>{row.model === "model" ? "Joint resampling" : row.model === "B1_fixed_vol" ? "Fixed volatility" : "Normal / EWMA"}</td>
                  <td>{row.horizon} days</td><td>{row.n}</td>
                  <td>{(row.outside_95 * 100).toFixed(1)}%</td>
                  <td>{(row.width_95 * 100).toFixed(1)}%</td>
                </tr>
              ))}
              {backtestRegime.length === 0 && <tr><td colSpan={5}>No regime split is available.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="section-sub">
          It widens when volatility rises, which fixed volatility does not. In this slice, the 7-day joint model has 0/9 misses, fixed volatility 2/9, and Normal/EWMA 1/9; mean widths are 23.8%, 12.7%, and 21.8%. Nine windows is too few to prove a general advantage, and we say that on the page. At 14 days, all three have 0/4 misses; model width is 34.1% versus 17.9% for fixed volatility.
        </p>
        <p className="section-sub">
          Close-based risk and backtest inputs use the full aligned market history ({health.market_rows_after_alignment ?? "—"} aligned gold/FX dates). The chart's OHLC export has {getData("candles")?.rows?.length ?? "—"} candles and is a separate, sparser display series.
        </p>
      </section>
    </div>
  );
}
