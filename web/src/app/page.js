import { getData } from "@/lib/data";
import { pct, lkr } from "@/lib/format";
import Banner from "@/components/Banner";
import JewellerCalculator from "@/components/JewellerCalculator";
import { resolveDashboardPricing } from "@/lib/dashboard-pricing";

export const dynamic = "force-dynamic";

/* ── Trend chart: pure SVG, no chart library needed ─────────── */
function Trend({ data }) {
  const pts = data.filter((d) => d.local != null && d.local_equiv != null).slice(-60);
  if (pts.length < 2) return null;

  const W = 640, H = 190, padX = 6, padTop = 10, padBottom = 22;
  const all = pts.flatMap((d) => [d.local, d.local_equiv]);
  const min = Math.min(...all), max = Math.max(...all);
  const room = (max - min || 1) * 0.1;
  const lo = min - room, hi = max + room;

  const x = (i) => padX + (i * (W - padX * 2)) / (pts.length - 1);
  const y = (v) => padTop + (1 - (v - lo) / (hi - lo)) * (H - padTop - padBottom);
  const path = (key) => pts.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const gap =
    path("local") + " " +
    [...pts].reverse().map((d, i) => `L${x(pts.length - 1 - i).toFixed(1)},${y(d.local_equiv).toFixed(1)}`).join(" ") + " Z";

  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img"
       aria-label="Historical Pettah prices compared with the world-equivalent price">
      {[0, 0.5, 1].map((t) => (
        <line key={t} className="grid" x1="0" x2={W} y1={padTop + t * (H - padTop - padBottom)} y2={padTop + t * (H - padTop - padBottom)} />
      ))}
      <path className="gap" d={gap} />
      <path className="line-world" d={path("local_equiv")} />
      <path className="line-local" d={path("local")} />
      <text x={padX} y={H - 5}>{pts[0].date}</text>
      <text x={W - padX} y={H - 5} textAnchor="end">{pts.at(-1).date}</text>
    </svg>
  );
}

/* ── One row of the "what moved the price" list ─────────────── */
function Driver({ name, hint, value, max, total, gold }) {
  const v = value ?? 0;
  const width = Math.min(50, (Math.abs(v) / max) * 50); // 50% = one full side of the centre line
  const dir = v >= 0 ? "up" : "down";
  return (
    <div className={`driver${total ? " total" : ""}`}>
      <div className="driver-name">
        {name}
        <span className="driver-hint">{hint}</span>
      </div>
      <div className={`driver-val ${v > 0 ? "move-up" : v < 0 ? "move-down" : "move-flat"}`}>
        {v > 0 ? "+" : ""}{pct(v)}
      </div>
      <div className="driver-track" aria-hidden="true">
        <div
          className={`driver-fill ${dir}`}
          style={{ width: `${width}%`, ...(gold ? { background: "var(--gold)" } : {}) }}
        />
      </div>
    </div>
  );
}

export default function Home() {
  const risk = getData("risk")?.h7 || {};
  const flags = getData("anomalies") || [];
  const history = getData("history") || [];
  const market = getData("market_reference") || {};
  const pricing = resolveDashboardPricing({ history, market });
  const lastMove = flags.length > 0 ? flags.at(-1) : null;
  const currentPrice = pricing.currentPrice;

  const moves = lastMove
    ? [lastMove.ret_local, lastMove.ret_world, lastMove.ret_fx, lastMove.ret_premium].map((n) => Math.abs(n ?? 0))
    : [];
  const maxMove = Math.max(...moves, 1e-9);

  const state =
    !pricing.quoteIsCurrent || !lastMove || lastMove.status === "cannot_assess"
      ? "wait"
      : lastMove.flag
        ? "bad"
        : "ok";

  return (
    <div className="page">
      <div className="page-head">
        <p className="page-kicker">Daily market overview</p>
        <h1>Latest gold brief</h1>
        <p>Current gold estimates in LKR, with Pettah comparisons when recent shop quotes are available.</p>
      </div>

      <Banner risk={risk} />

      {/* ── The tray: latest price + trend ── */}
      <section className="hero" aria-label="Current gold price">
        <div className="hero-head">
          <div>
            <p className="hero-label">{pricing.priceLabel}</p>
            <p className="hero-price">{lkr(currentPrice)}</p>
          </div>
          <div className="hero-chips">
            <span className="chip">
              Pettah shop quote: <b>{pricing.quoteIsCurrent ? pricing.quoteDate : "not available"}</b>
            </span>
            <span className="chip">
              World gold: <b>{pricing.goldDate || "feed unavailable"}</b>
            </span>
            <span className="chip">
              USD/LKR: <b>{pricing.fxDate || "feed unavailable"}</b>
            </span>
          </div>
        </div>

        {history.length > 1 && (
          <div className="hero-chart">
            <div className="hero-chart-top">
              <span>Historical Pettah quotes vs the world-gold equivalent</span>
              <span style={{ display: "inline-flex", gap: "1rem" }}>
                <span className="legend"><i /> Pettah</span>
                <span className="legend"><i className="dash" /> World equivalent</span>
              </span>
            </div>
            <Trend data={history} />
          </div>
        )}

        <div className="hero-stats">
          <div className="hero-stat">
            <p className="k">Same gold at world prices</p>
            <p className="v">{lkr(pricing.worldEquivalentPrice)}</p>
          </div>
          <div className="hero-stat">
            <p className="k">Pettah premium over world price</p>
            <p className="v">{pct(pricing.premium)}</p>
          </div>
          <div className="hero-stat">
            <p className="k">Premium on one sovereign</p>
            <p className="v">
              {pricing.premiumDifference == null
                ? "—"
                : `${pricing.premiumDifference >= 0 ? "+" : ""}${lkr(pricing.premiumDifference)}`}
            </p>
          </div>
        </div>
        {!pricing.quoteIsCurrent && (
          <p className="section-sub">
            No recent Pettah shop quote is available; the displayed price is a market-derived estimate, not a retail offer.
          </p>
        )}
      </section>

      <div className="two-col">
        {/* ── Why the price moved ── */}
        <section className="card panel">
          <div className="panel-head">
            <h2 className="panel-title">
              {pricing.quoteIsCurrent ? "Why the price moved" : "Historical Pettah price movement"}
              {lastMove?.date ? ` on ${lastMove.date}` : ""}
            </h2>
            <p className="panel-sub">
              {pricing.quoteIsCurrent
                ? "The three parts add up exactly to the total change in the Pettah price."
                : "This historical breakdown is not a current shop quote or price assessment."}
            </p>
          </div>

          {lastMove ? (
            <>
              <Driver total name="Pettah price change" hint="What you saw at the counter" value={lastMove.ret_local} max={maxMove} gold />
              <Driver name="World gold price" hint="Gold in US dollars on world markets" value={lastMove.ret_world} max={maxMove} />
              <Driver name="Rupee against the dollar" hint="A weaker rupee pushes the local price up" value={lastMove.ret_fx} max={maxMove} />
              <Driver name="Local premium" hint="Extra charged in Pettah over the world price" value={lastMove.ret_premium} max={maxMove} />
            </>
          ) : (
            <p className="text-muted">
              We need at least two days of quotes in a row before we can split a price move into its parts.
            </p>
          )}
        </section>

        {/* ── Is the latest quote normal? ── */}
        <section className="card panel">
          <div className="panel-head">
            <h2 className="panel-title">Does the latest quote look normal?</h2>
            <p className="panel-sub">We compare the latest local premium with its usual range.</p>
          </div>

          {state === "wait" && (
            <div className="status wait">
              <div className="status-icon" aria-hidden="true">?</div>
              <div>
                <h3>No recent Pettah quote to compare</h3>
                <p>
                  The current market estimate is available above. A shop premium comparison appears when a recent verified Pettah quote is available.
                </p>
              </div>
            </div>
          )}
          {state === "bad" && (
            <div className="status bad">
              <div className="status-icon" aria-hidden="true">!</div>
              <div>
                <h3>The latest premium looks unusual</h3>
                <p>
                  The local premium moved much more than it normally does. Check your dealer&apos;s quote before you reprice.
                  This is a warning to look closer, not a sign the market will fall.
                </p>
              </div>
            </div>
          )}
          {state === "ok" && (
            <div className="status ok">
              <div className="status-icon" aria-hidden="true">✓</div>
              <div>
                <h3>The latest quote looks normal</h3>
                <p>The local premium is within its usual range. Nothing unusual to act on.</p>
              </div>
            </div>
          )}

          {lastMove?.z != null && state !== "wait" && (
            <p className="status-detail">
              Technical detail: robust z-score {lastMove.z.toFixed(2)}. We flag anything above 3.5.
            </p>
          )}
        </section>
      </div>

      <JewellerCalculator
        initialPrice={currentPrice}
        initialPriceLabel={pricing.priceInputLabel}
        riskData={risk}
      />
    </div>
  );
}