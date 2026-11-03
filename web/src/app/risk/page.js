import { getData } from "@/lib/data";
import { pct, lkr } from "@/lib/format";
import { daysSinceDate, todayInSriLanka } from "@/lib/date";
import Banner from "@/components/Banner";
import JewellerCalculator from "@/components/JewellerCalculator";

export const dynamic = "force-dynamic";
const LEVELS = [1, 5, 25, 50, 75, 95, 99];

function Block({ risk, title }) {
  if (!risk) return null;

  return (
    <section className="card panel">
      <div className="section-header">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-sub">
            Starting baseline: {lkr(risk.start_price_8g)} per 8 g · {risk.quote_date}
            {" "}· {risk.start_source}
          </p>
        </div>
        <span className={`badge ${risk.status === "ok" ? "badge-success" : "badge-warning"}`}>
          {risk.status === "ok" ? "Model range available" : "Cannot assess"}
        </span>
      </div>

      {risk.status !== "ok" ? (
        <div className="risk-callout" style={{ padding: "1rem" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>
            Fresh quotes are required before the model can provide this range.
          </p>
          {risk.notes?.length > 0 && (
            <p style={{ margin: ".45rem 0 0", color: "var(--text-secondary)" }}>
              {risk.notes.join(" ")}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="scroll-x">
            <table className="risk-table">
              <thead>
                <tr>
                  <th scope="col">Percentile</th>
                  <th scope="col">Per 8 g</th>
                  <th scope="col">1 kg exposure</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((level) => (
                  <tr key={level} className={level === 5 ? "risk-low" : level === 50 ? "risk-median" : ""}>
                    <td>{level}% {level === 5 ? "· downside tail" : level === 50 ? "· median" : ""}</td>
                    <td>{lkr(risk.range_8g?.[`p${level}`])}</td>
                    <td>{lkr(risk.stock_1kg_lkr?.[`p${level}`])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="metric-grid" style={{ marginTop: "1rem" }}>
            <div className="metric-tile">
              <span className="stat-label">Probability of a fall over 5%</span>
              <p className="stat-value">{pct(risk.prob_fall_5pct, 0)}</p>
            </div>
            <div className="metric-tile">
              <span className="stat-label">Probability of a fall over 10%</span>
              <p className="stat-value">{pct(risk.prob_fall_10pct, 0)}</p>
            </div>
            <div className="metric-tile">
              <span className="stat-label">Historical premium stress · per 8 g</span>
              <p className="stat-value text-danger">{lkr(risk.premium_stress_8g)}</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default function RiskPage() {
  const risk = getData("risk") || {};
  const market = getData("market_reference") || {};
  const dealerQuotes = getData("dealer_quotes") || {};
  const h7 = risk.h7;
  const h14 = risk.h14;
  const marketIsCurrent = market.status === "current";
  const dealerReference = market.dealer_reference;
  const dealerAgeDays = daysSinceDate(dealerReference?.rate_date, todayInSriLanka());
  const dealerReferenceIsCurrent =
    dealerReference?.status === "current" &&
    Number.isFinite(dealerReference.price_lkr_per_8g) &&
    dealerReference.price_lkr_per_8g > 0 &&
    dealerAgeDays != null &&
    dealerAgeDays >= 0 &&
    dealerAgeDays <= 7;

  return (
    <div className="page">
      <header className="page-head">
        <p className="page-kicker">Inventory planning</p>
        <h1>Stock risk</h1>
        <p>Explore historical price ranges for your stock and restocking horizon.</p>
      </header>

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Daily gold benchmarks</h2>
            <p className="section-sub">
              International market proxy and LKR conversions. Pettah retail prices are not supplied by this feed.
            </p>
          </div>
          <span className={`badge ${marketIsCurrent ? "badge-success" : "badge-warning"}`}>
            {marketIsCurrent ? "Fresh market feeds" : "Market feed unavailable or stale"}
          </span>
        </div>
        {marketIsCurrent ? (
          <>
            <div className="metric-grid">
              <div className="metric-tile">
                <span className="stat-label">World gold proxy</span>
                <p className="stat-value">US$ {market.gold_usd_per_oz?.toLocaleString("en-US", { maximumFractionDigits: 2 })} / troy oz</p>
                <p className="section-sub">{market.gold_date} · {market.gold_source}</p>
              </div>
              <div className="metric-tile">
                <span className="stat-label">USD / LKR</span>
                <p className="stat-value">{market.usd_lkr?.toFixed(2)}</p>
                <p className="section-sub">{market.fx_date} · {market.fx_source}</p>
              </div>
              {[24, 22, 18].map((karat) => (
                <div className="metric-tile" key={karat}>
                  <span className="stat-label">{karat}K benchmark · LKR / g</span>
                  <p className="stat-value">{lkr(market[`lkr_per_gram_${karat}k`])}</p>
                  <p className="section-sub">
                    {lkr(market[`lkr_per_8g_${karat}k`])} per 8 g
                  </p>
                </div>
              ))}
              {dealerReferenceIsCurrent && (
                <div className="metric-tile">
                  <span className="stat-label">Sri Lankan 22K dealer guide · LKR / 8 g</span>
                  <p className="stat-value">{lkr(dealerReference.price_lkr_per_8g)}</p>
                  <p className="section-sub">
                    Median of {dealerReference.quote_count} listed/selling dealer rates · {dealerReference.rate_date}
                  </p>
                </div>
              )}
            </div>
            <p className="section-sub" style={{ marginTop: "1rem" }}>
              The simulator uses a fresh 22K dealer median as its starting value when available; otherwise it falls back to the world-gold and FX benchmark.
              Future ranges model gold and rupee movement only, not retail premiums, making charges, or taxes.
            </p>
          </>
        ) : (
          <p className="risk-callout" role="status">
            A current benchmark cannot be calculated until the market feeds refresh successfully. No old Pettah quote is substituted.
          </p>
        )}
      </section>

      <Banner risk={h7} />

      <JewellerCalculator
        initialPrice={h7?.status === "ok" ? h7.start_price_8g : null}
        initialPriceLabel={
          h7?.status === "ok" && h7.start_source === "current Sri Lankan 22K dealer median"
            ? "Sri Lankan dealer guide"
            : h7?.status === "ok" && h7.start_source === "daily world-gold and USD/LKR benchmark"
              ? "Daily market estimate"
              : "22K risk baseline"
        }
        riskData={risk}
        dealerQuoteRows={dealerQuotes.rows || []}
        today={todayInSriLanka()}
      />

      <Block risk={h7} title="7-day restocking horizon" />
      <Block risk={h14} title="14-day restocking horizon" />

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Limits and assumptions</h2>
            <p className="section-sub">How to interpret these model estimates.</p>
          </div>
        </div>
        <ul className="assumption-list">
          {(h7?.assumptions || []).map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
          <li>
            These ranges estimate uncertainty from historical data. They are not financial advice or a guarantee of future prices.
          </li>
        </ul>
      </section>
    </div>
  );
}
