import { getData } from "@/lib/data";
import { lkr } from "@/lib/format";
import { daysSinceDate, todayInSriLanka } from "@/lib/date";

export const dynamic = "force-dynamic";

const SOURCES = [
  ["World gold", "Yahoo Finance GC=F futures closes (proxy, not spot)."],
  ["USD / LKR", "The ingest step uses the configured CBSL CSV when present; otherwise it falls back to Yahoo Finance LKR=X. The refresh card shows the source and fallback reason for the latest date."],
  ["CBSL gold reference", "CBSL indicative XAU/LKR daily table, fetched through AllRatesToday and refreshed hourly; a link to the provider is shown with the rate."],
  ["Pettah 22K", "14 archived Colombo Sea Street quotes from Ada Derana and The Morning; newest is 2026-05-06. Search through 2026-11-05 found no qualifying Oct-Nov 2026 quote to add."],
  ["Dealer prices", "Public Sri Lankan dealer feed. Per-row rate dates and observation times are shown separately; it is not Pettah-specific."],
];

export default function Health() {
  const health = getData("health") || {};
  const backtest = getData("backtest") || [];
  const backtestRegime = getData("backtest_regime") || [];
  const backtestFxSensitivity = getData("backtest_fx_sensitivity") || [];
  const backtestFxSensitivityRegime = getData("backtest_fx_sensitivity_regime") || [];
  const fxAudit = getData("fx_audit") || {};
  const refresh = getData("refresh") || {};
  const forecast = getData("ml_forecast") || {};
  const market = getData("market_reference") || {};
  const filterAuditStats = backtestFxSensitivity.find((row) => row.fx_version === "yahoo_reversal_filter") || {};
  const auditDifferenceCount = fxAudit.return_difference_over_threshold_dates ?? 0;
  const filterFlagCount = filterAuditStats.fx_filter_flagged_days ?? 75;
  const filterAuditOverlap = filterAuditStats.fx_filter_overlap_with_return_audit ?? 63;
  const sensitivityRows = backtestFxSensitivity;
  const fxVersionLabel = (version) => ({
    raw_yahoo: "Raw Yahoo",
    yahoo_reviewed_unfiltered: "Yahoo + reviewed CBSL overrides (control)",
    yahoo_reversal_filter: "Yahoo + reversal filter",
    cbsl_primary_yahoo_gap_fill: "CBSL primary + Yahoo gap fill",
  }[version] || version);
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
              {item?.source_reason && <p className="section-sub">{item.source_reason}</p>}
              <span className={`badge ${state.status === "current" ? "badge-success" : state.status === "stale" ? "badge-warning" : "badge-neutral"}`}>
                {state.status}
                {state.working_days_old != null && ` · ${state.working_days_old} working days old`}
              </span>
            </div>
          );})}
        </div>
        {market.fx_date === "2026-11-05" && market.fx_source?.includes("Yahoo") && (
          <p className="refresh-warning" style={{ marginTop: ".75rem" }}>
            <strong>5 Nov USD/LKR source check:</strong> the rate used was Yahoo LKR=X at Rs {Number(market.usd_lkr).toFixed(4)} because the scheduled runner had no configured CBSL CSV. The CBSL published 5 Nov value served by <a href="https://allratestoday.com/central-bank-rates-api/cbsl/" target="_blank" rel="noreferrer">AllRatesToday</a> is Rs 332.7858; Yahoo is Rs {(332.7858 - Number(market.usd_lkr)).toFixed(4)} lower ({(Math.abs(332.7858 / Number(market.usd_lkr) - 1) * 100).toFixed(3)}%). This is a manual cross-check only; it was not substituted for the Yahoo input.
          </p>
        )}
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
          The configured GitHub Actions cron is 12:00 Colombo time. The latest run is recorded as a scheduled event, but its 14:49 UTC start does not match that cron time; the cause is unknown. Successful updates are committed and trigger Vercel deployment. A successful download does not guarantee a current Pettah retail price.
        </p>
      </section>

      <section className="card panel" style={{ order: 100 }}>
        <details>
          <summary className="section-title">Experimental ridge forecast — not a demo signal</summary>
          <p className="section-sub" style={{ marginTop: ".5rem" }}>
            It doesn’t beat the no-change baseline, and one new day moved it by about 0.9 points, which is why we label it experimental. The forecast changed from +0.32% to +1.20%.
          </p>
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
        </details>
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
                  <td>{key === "fx_cbsl_overrides_applied" ? "Historical CBSL overrides (2–4 Nov 2026)" : key.replaceAll("_", " ")}</td>
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
        <details style={{ marginTop: "1.25rem" }}>
          <summary className="section-title">Post-submission FX cleaning sensitivity</summary>
          <p className="section-sub" style={{ marginTop: ".5rem" }}>
            Rerun on 5 Nov data: {filterFlagCount} Yahoo levels flagged; {filterAuditOverlap} overlap the {auditDifferenceCount}-date Yahoo/CBSL return-difference audit. The filter excludes 7 Mar–30 Apr 2022 and interpolates up to two missing levels. The four FX variants use the same {sensitivityRows[0]?.market_return_rows ?? "—"} aligned daily-return dates; window counts are shown below. This is a sensitivity analysis, not proof that a provider is wrong.
          </p>
          <div className="scroll-x">
            <table className="data-table">
              <thead><tr><th>FX input</th><th>Model</th><th>Horizon</th><th>Windows</th><th>Outside 95%</th><th>Mean 95% width</th><th>Pinball loss</th></tr></thead>
              <tbody>{sensitivityRows.map((row) => (
                <tr key={`${row.fx_version}-${row.model}-${row.horizon}`}>
                  <td>{fxVersionLabel(row.fx_version)}</td>
                  <td>{row.model === "model" ? "Joint resampling" : row.model === "B1_fixed_vol" ? "Fixed volatility" : "Normal / EWMA"}</td>
                  <td>{row.horizon} days</td><td>{row.n}</td>
                  <td>{(row.outside_95 * 100).toFixed(1)}%</td><td>{(row.width_95 * 100).toFixed(2)}%</td><td>{row.pinball.toFixed(4)}</td>
                </tr>
              ))}
              {!sensitivityRows.length && <tr><td colSpan={7}>No FX sensitivity results are available.</td></tr>}</tbody>
            </table>
          </div>
          <p className="section-sub" style={{ marginTop: ".75rem" }}>
            On this rerun, the reversal-filter model’s interval narrowed from 13.90% to 13.14% at 7 days and 19.84% to 18.70% at 14 days versus the reviewed-Yahoo control; outside rates were closer to the 5% target and pinball loss was slightly lower. CBSL-primary was wider and less calibrated. Raw Yahoo and the unfiltered reviewed control round to identical results. The Jan–Mar split has only 9 seven-day and 4 fourteen-day windows. <a href="/data/backtest_fx_sensitivity.csv" download>Download all FX variants and baselines (CSV)</a>.
          </p>
          <h3 className="section-title" style={{ marginTop: "1rem" }}>FX variants in Jan–Mar 2026</h3>
          <div className="scroll-x">
            <table className="data-table">
              <thead><tr><th>FX input</th><th>Model</th><th>Horizon</th><th>Windows</th><th>Outside 95%</th><th>Mean 95% width</th></tr></thead>
              <tbody>{backtestFxSensitivityRegime.map((row) => (
                <tr key={`${row.fx_version}-${row.model}-${row.horizon}`}>
                  <td>{fxVersionLabel(row.fx_version)}</td>
                  <td>{row.model === "model" ? "Joint resampling" : row.model === "B1_fixed_vol" ? "Fixed volatility" : "Normal / EWMA"}</td>
                  <td>{row.horizon} days</td><td>{row.n}</td>
                  <td>{(row.outside_95 * 100).toFixed(1)}% ({Math.round(row.outside_95 * row.n)}/{row.n})</td>
                  <td>{(row.width_95 * 100).toFixed(2)}%</td>
                </tr>
              ))}
              {!backtestFxSensitivityRegime.length && <tr><td colSpan={6}>No FX regime sensitivity results are available.</td></tr>}</tbody>
            </table>
          </div>
        </details>
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
          It widens when volatility rises, which fixed volatility does not. In this slice, the 7-day joint model has 1/9 misses, fixed volatility 2/9, and Normal/EWMA 1/9; mean widths are 23.3%, 12.0%, and 21.1%. Nine windows is too few to prove a general advantage, and we say that on the page. At 14 days, all three have 0/4 misses; model width is 32.4% versus 17.0% for fixed volatility.
        </p>
        <p className="section-sub">
          Close-based risk and backtest inputs use the full aligned market history ({health.market_rows_after_alignment ?? "—"} aligned gold/FX dates). The chart's OHLC export has {getData("candles")?.rows?.length ?? "—"} candles and is a separate, sparser display series.
        </p>
      </section>
    </div>
  );
}
