import { getData } from "@/lib/data";
import { pct, lkr } from "@/lib/format";
import Banner from "@/components/Banner";
import JewellerCalculator from "@/components/JewellerCalculator";
import MarketCandles from "@/components/MarketCandles";
import RiskRangeCard from "@/components/RiskRangeCard";
import CbslGoldReference from "@/components/CbslGoldReference";
import { resolveDashboardPricing } from "@/lib/dashboard-pricing";
import { daysSinceDate, todayInSriLanka } from "@/lib/date";

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
  const allRisk = getData("risk") || {};
  const risk = allRisk.h7 || {};
  const flags = getData("anomalies") || [];
  const history = getData("history") || [];
  const attribution = getData("attribution") || {};
  const localQuotes = getData("local_quotes") || [];
  const lastPettahQuote = localQuotes.filter((quote) => quote.source_type === "pettah").at(-1);
  const pettahAgeDays = daysSinceDate(lastPettahQuote?.date, todayInSriLanka());
  const market = getData("market_reference") || {};
  const candles = getData("candles") || {};
  const pricing = resolveDashboardPricing({ history, market });
  const lastMove = flags.length > 0 ? flags.at(-1) : null;
  const latestDealerMove = attribution.moves?.at(-1);
  const latestSuppressedMove = attribution.suppressed_moves?.at(-1);
  const dealerMove = latestSuppressedMove && (!latestDealerMove || latestSuppressedMove.date > latestDealerMove.date)
    ? null
    : latestDealerMove;
  const currentPrice = pricing.currentPrice;

  const moves = lastMove
    ? [lastMove.ret_local, lastMove.ret_world, lastMove.ret_fx, lastMove.ret_premium].map((n) => Math.abs(n ?? 0))
    : [];
  const maxMove = Math.max(...moves, 1e-9);
  const dealerMaxMove = dealerMove
    ? Math.max(Math.abs(dealerMove.dealer_log_return), Math.abs(dealerMove.world_log_return), Math.abs(dealerMove.rupee_log_return), Math.abs(dealerMove.dealer_premium_log_return), 1e-9)
    : 1e-9;
  const latestCandle = candles.rows?.at(-1);
  const previousCandle = candles.rows?.at(-2);
  const benchmarkClose22 = latestCandle?.close_22k ?? latestCandle?.close;
  const benchmarkClose24 = latestCandle?.close_24k;
  const previousClose22 = previousCandle?.close_22k ?? previousCandle?.close;
  const priorObservationGapDays = latestCandle && previousCandle
    ? daysSinceDate(previousCandle.date, latestCandle.date)
    : null;
  const benchmarkChange22 = Number.isFinite(benchmarkClose22) && Number.isFinite(previousClose22) && previousClose22 > 0
    ? (benchmarkClose22 - previousClose22) / previousClose22
    : null;
  const latestLocalQuote = localQuotes.at(-1);

  return (
    <div className="page">
      <div className="page-head">
        <p className="page-kicker">Daily market overview</p>
        <h1>Latest gold brief</h1>
        <p>Current Sri Lankan dealer references with Pettah comparisons when recent shop quotes are available.</p>
      </div>

      <RiskRangeCard risk={risk} title="7-day Stock Risk range" />

      <Banner risk={risk} />

      <section className="card panel" aria-label="Pettah report freshness">
        <div className="section-header">
          <div>
            <h2 className="section-title">Pettah report freshness</h2>
            <p className="section-sub">
              Dealer listings are the current local reference. Pettah is sparse press data; no values are filled between reports.
            </p>
            <p className="section-sub">Latest Pettah report: {lastPettahQuote?.date || "not available"}</p>
          </div>
          <span className={`badge ${pettahAgeDays != null && pettahAgeDays > 30 ? "badge-warning" : "badge-info"}`}>
            {pettahAgeDays == null ? "Pettah age unavailable" : `Days since last Pettah report: ${pettahAgeDays}`}
          </span>
        </div>
      </section>

      {/* ── The tray: latest price + trend ── */}
      <section className="hero" aria-label="Current gold price">
        <div className="hero-head">
          <div>
            <p className="hero-label">{pricing.priceLabel}</p>
            <p className="hero-price">{lkr(currentPrice)}</p>
          </div>
          <div className="hero-chips">
            <span className="chip">
              Pettah news archive through: <b>{history.at(-1)?.date || "not available"}</b>
            </span>
            <span className="chip">
              Selected local reference: <b>{pricing.quoteIsCurrent
                ? `Pettah report · ${pricing.quoteDate}`
                : pricing.dealerReferenceIsCurrent
                  ? `Dated dealer listings · ${pricing.dealerReferenceDate} · ${pricing.dealerReferenceCount} shops`
                  : "world-gold estimate"}</b>
            </span>
            <span className="chip">
              World gold: <b>{pricing.goldDate || "feed unavailable"}{market.gold_source ? ` · ${market.gold_source}` : ""}</b>
            </span>
            <span className="chip">
              USD/LKR: <b>{pricing.fxDate || "feed unavailable"}{market.fx_source ? ` · ${market.fx_source}` : ""}</b>
            </span>
          </div>
        </div>

        {(candles.rows?.length > 0 || history.length > 1) && (
          <div className="hero-chart">
            <div className="hero-chart-top">
              <span>
                {candles.rows?.length > 0
                  ? `Market-derived candles · latest feed date ${candles.rows.at(-1).date}`
                  : "Historical Pettah quotes vs the world-gold equivalent"}
              </span>
            </div>
            {candles.rows?.length > 0
              ? (
                <MarketCandles
                  snapshot={candles}
                  dealerReference={pricing.dealerReferenceIsCurrent ? market.dealer_reference : null}
                  localQuotes={localQuotes}
                />
              )
              : <Trend data={history} />}
          </div>
        )}

        <div className="hero-stats">
          <div className="hero-stat">
            <p className="k">World-gold benchmark · 22K / 8 g</p>
            <p className="v">{lkr(pricing.worldEquivalentPrice)}</p>
            <small>{market.gold_source || "Gold source unavailable"}</small>
          </div>
          <div className="hero-stat">
            <p className="k">Selected local reference · 22K / 8 g</p>
            <p className="v">{lkr(currentPrice)}</p>
          </div>
          <div className="hero-stat">
            <p className="k">Dated local observations</p>
            <p className="v">{localQuotes.length.toLocaleString()}</p>
          </div>
        </div>
      </section>

      <div className="two-col market-price-comparison">
        <section className="card panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">Market benchmark by purity</h2>
              <p className="section-sub">
                Derived from {market.gold_source || "gold feed"} and {market.fx_source || "USD/LKR feed"} · {market.gold_date || "date unavailable"}
              </p>
            </div>
          </div>
          <div className="metric-grid">
            {[24, 22, 18].map((karat) => (
              <div className="metric-tile" key={karat}>
                <span className="stat-label">{karat}K · LKR / 8 g</span>
                <p className="stat-value">{lkr(market[`lkr_per_8g_${karat}k`])}</p>
              </div>
            ))}
          </div>
          <p className="section-sub" style={{ marginTop: ".75rem" }}>
            World-gold and USD/LKR conversion only; dealer premiums, workmanship, and taxes are excluded.
          </p>
        </section>
        <CbslGoldReference />
      </div>

      <div className="two-col">
        <section className="card panel">
          <div className="panel-head">
            <h2 className="panel-title">Dealer price attribution{dealerMove?.date ? ` on ${dealerMove.date}` : ""}</h2>
            <p className="panel-sub">
              Source: {dealerMove?.source || "published dealer listings"}. Quote date: {dealerMove?.date || "not available"}.
              {dealerMove?.institutions?.length ? ` Institutions: ${dealerMove.institutions.join(", ")}.` : ""}
            </p>
          </div>
          {dealerMove ? (
            <>
              <Driver total name="Dealer 22K / 8 g change" hint="Published dealer listings" value={dealerMove.dealer_log_return} max={dealerMaxMove} gold />
              <Driver name="World gold" hint={`USD/oz · ${dealerMove.gold_date}`} value={dealerMove.world_log_return} max={dealerMaxMove} />
              <Driver name="Rupee" hint={`USD/LKR · ${dealerMove.fx_date}`} value={dealerMove.rupee_log_return} max={dealerMaxMove} />
              <Driver name="Dealer premium" hint="Dealer price relative to world equivalent" value={dealerMove.dealer_premium_log_return} max={dealerMaxMove} />
              {attribution.fx_crosscheck_dates?.includes(dealerMove.date) && (
                <p className="panel-sub">
                  CBSL cross-check applied to USD/LKR: Rs 332.60 on 2 and 3 Nov and Rs 332.64 on 4 Nov. Yahoo LKR=X had Rs 322.44 and Rs 322.54 on 2 and 3 Nov; those two prints were corrected in derived returns.
                </p>
              )}
              <p className="panel-sub">Quote: {lkr(dealerMove.dealer_price_lkr_per_8g)} · {dealerMove.date}</p>
              {dealerMove.source_urls?.map((url) => <p className="panel-sub" key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></p>)}
            </>
          ) : attribution.suppressed_moves?.length ? (
            <p className="text-muted">Attribution for {attribution.suppressed_moves.at(-1).previous_date} to {attribution.suppressed_moves.at(-1).date} is suppressed because Yahoo Finance LKR=X has an unverified move above 1.5%. Compare this interval with CBSL before using the split.</p>
          ) : <p className="text-muted">At least two dated dealer observations with market data are needed for attribution.</p>}
        </section>

        {/* ── Why the price moved ── */}
        <section className="card panel">
          <div className="panel-head">
            <h2 className="panel-title">
              Historical Pettah
              {lastMove?.date ? ` on ${lastMove.date}` : ""}
            </h2>
            <p className="panel-sub">
              Sparse press reports, shown separately from current dated dealer listings.
            </p>
          </div>

          {lastMove ? (
            <>
              <Driver total name="Reported Pettah price change" hint="Historical press observation" value={lastMove.ret_local} max={maxMove} gold />
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

        {/* ── Dated market context ── */}
        <section className="card panel">
          <div className="panel-head">
            <h2 className="panel-title">Market snapshot</h2>
            <p className="panel-sub">
              Daily benchmark closes use international gold and USD/LKR data; local observations retain their source and quote date.
            </p>
          </div>
          <div className="forecast-metrics">
            <div>
              <p className="k">22K close · LKR / 8 g</p>
              <p className="v">{Number.isFinite(benchmarkClose22) ? lkr(benchmarkClose22) : "Unavailable"}</p>
              <small>{latestCandle?.date || "No daily benchmark date"}</small>
              {benchmarkChange22 != null && (
                <small>
                  {benchmarkChange22 > 0 ? "+" : ""}{pct(benchmarkChange22)} from the prior observed close
                  {priorObservationGapDays != null && ` (${priorObservationGapDays} calendar days earlier)`}
                </small>
              )}
            </div>
            <div>
              <p className="k">24K close · LKR / 8 g</p>
              <p className="v">{Number.isFinite(benchmarkClose24) ? lkr(benchmarkClose24) : "Unavailable"}</p>
              <small>{latestCandle?.date || "No daily benchmark date"}</small>
            </div>
            <div>
              <p className="k">Latest local observation</p>
              <p className="v">{latestLocalQuote ? lkr(latestLocalQuote.price_lkr_per_8g) : "—"}</p>
              <small>
                {latestLocalQuote
                  ? `${latestLocalQuote.karat}K · ${latestLocalQuote.source} · ${latestLocalQuote.date}`
                  : "Dated Pettah and retailer observations are shown when collected"}
              </small>
            </div>
          </div>
        </section>
      </div>

      <JewellerCalculator
        initialPrice={currentPrice}
        initialPriceLabel={pricing.priceInputLabel}
        riskData={allRisk}
      />
    </div>
  );
}
