import { getData } from "@/lib/data";
import { pct, lkr } from "@/lib/format";
import LineChart from "@/components/LineChart";
import MarketCandles from "@/components/MarketCandles";
import CbslGoldReference from "@/components/CbslGoldReference";

export const dynamic = "force-dynamic";

export default function ChangesPage() {
  const history = getData("history") || [];
  const localQuotes = getData("local_quotes") || [];
  const moves = getData("moves") || [];
  const candles = getData("candles") || {};
  const marketHistory = getData("market_history") || {};
  const market = getData("market_reference") || {};
  const latestPettahDate = history.at(-1)?.date;
  const latestLocalQuote = localQuotes.at(-1);
  const localQuoteCount = localQuotes.length;
  const dealerReference = market.dealer_reference?.status === "current"
    ? market.dealer_reference
    : null;

  const chartLines = [
    { key: "world_equivalent", label: "Daily world equivalent · 22K / 8 g", color: "var(--chart-world)" },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <p className="page-kicker">Market history</p>
        <h1>What changed</h1>
        <p>Review reported Pettah quotes separately from the daily gold-and-FX benchmark and published dealer rates.</p>
      </header>

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Pettah reports and daily world equivalent</h2>
            <p className="section-sub">
              Daily 22K world-equivalent closes with dated Pettah reports overlaid as individual points.
              {marketHistory.as_of_date ? ` · market data through ${marketHistory.as_of_date}` : ""}
              {latestPettahDate ? ` · last Pettah report ${latestPettahDate}` : ""}
            </p>
          </div>
          <span className="badge badge-neutral">{history.length} Pettah reports</span>
        </div>
        <div className="chart-frame">
          <LineChart
            data={marketHistory.rows || []}
            markers={marketHistory.pettah_markers || []}
            lines={chartLines}
            height={330}
            dataUrl="/data/market_history.json"
          />
        </div>
        <p className="section-sub" style={{ marginTop: "1rem" }}>
          The market line refreshes from the daily gold/FX exports while this page is open. Pettah points update when a new dated report is added to the source archive; no prices are interpolated. Dealer listings remain a separate local reference.
        </p>
      </section>

      <CbslGoldReference />

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Daily market benchmark</h2>
            <p className="section-sub">
              Select 24K, 22K, or 18K daily OHLC candles (LKR/8 g), derived from international gold and USD/LKR data and overlaid with dated local observations.
              {candles.rows?.length ? ` · feed through ${candles.rows.at(-1).date}` : ""}
              {latestLocalQuote ? ` · latest local observation ${latestLocalQuote.date} (${latestLocalQuote.source})` : ""}
            </p>
          </div>
          <span className={`badge ${candles.status === "available" ? "badge-info" : "badge-neutral"}`}>
            {candles.status === "available" ? `${candles.rows.length.toLocaleString()} daily observations` : "Benchmark unavailable"}
          </span>
        </div>
        <MarketCandles snapshot={candles} dealerReference={dealerReference} localQuotes={localQuotes} />
        <p className="section-sub" style={{ marginTop: "1rem" }}>
          The daily benchmark is derived from world gold and FX.           Circle markers are reported Pettah prices; square markers are published dealer listings. Dealer rates are not relabeled as Pettah quotes or live trades.
        </p>
      </section>

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Recent price moves</h2>
            <p className="section-sub">
              Δln(local) = Δln(world gold) + Δln(USD/LKR) + Δln(local premium)
            </p>
          </div>
        </div>
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Pettah</th>
                <th scope="col">World gold</th>
                <th scope="col">USD / LKR</th>
                <th scope="col">Local premium</th>
              </tr>
            </thead>
            <tbody>
              {moves.slice(-10).reverse().map((move) => (
                <tr key={move.date}>
                  <td>{move.date}</td>
                  <td className={move.ret_local >= 0 ? "move-up" : "move-down"}>
                    {move.ret_local > 0 ? "▲ " : move.ret_local < 0 ? "▼ " : ""}{pct(move.ret_local)}
                  </td>
                  <td className={move.ret_world >= 0 ? "move-up" : "move-down"}>
                    {move.ret_world > 0 ? "▲ " : move.ret_world < 0 ? "▼ " : ""}{pct(move.ret_world)}
                  </td>
                  <td className={move.ret_fx >= 0 ? "move-up" : "move-down"}>
                    {move.ret_fx > 0 ? "▲ " : move.ret_fx < 0 ? "▼ " : ""}{pct(move.ret_fx)}
                  </td>
                  <td className={Math.abs(move.ret_premium) > 0.05 ? "text-warning" : "text-secondary"}>
                    {move.ret_premium > 0 ? "▲ " : move.ret_premium < 0 ? "▼ " : ""}{pct(move.ret_premium)}
                  </td>
                </tr>
              ))}
              {moves.length === 0 && (
                <tr><td colSpan={5}>No move data available yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Local quote observations</h2>
            <p className="section-sub">
              {localQuoteCount} dated observations · latest {latestLocalQuote
                ? `${latestLocalQuote.date} · ${latestLocalQuote.source}`
                : "not available"}.
              Pettah reports take precedence on matching dates; dealer listings fill dates with no Pettah report.
            </p>
          </div>
        </div>
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Quote date</th>
                <th scope="col">Source</th>
                <th scope="col">Karat</th>
                <th scope="col">LKR per 8 g</th>
                <th scope="col">Reported by</th>
              </tr>
            </thead>
            <tbody>
              {localQuotes.slice(-12).reverse().map((quote) => (
                <tr key={`${quote.date}-${quote.karat}-${quote.source_type}`}>
                  <td>{quote.date}</td>
                  <td>{quote.source}</td>
                  <td>{quote.karat}K</td>
                  <td>{lkr(quote.price_lkr_per_8g)}</td>
                  <td>{quote.contributors.join(", ") || "—"}</td>
                </tr>
              ))}
              {localQuotes.length === 0 && (
                <tr><td colSpan={5}>No local quote history is available yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
