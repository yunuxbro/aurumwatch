import { getData } from "@/lib/data";
import { pct, lkr } from "@/lib/format";
import LineChart from "@/components/LineChart";

export const dynamic = "force-dynamic";

export default function ChangesPage() {
  const history = getData("history") || [];
  const moves = getData("moves") || [];

  const chartLines = [
    { key: "local", label: "Pettah 22K (8g)", color: "var(--chart-gold)" },
    { key: "local_equiv", label: "World equivalent (LKR)", color: "var(--chart-world)" },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <p className="page-kicker">Market history</p>
        <h1>What changed</h1>
        <p>Compare Pettah quotes with the international gold price translated into rupees.</p>
      </header>

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Price history</h2>
            <p className="section-sub">LKR per 8 g sovereign · local quote versus world-equivalent value</p>
          </div>
          <span className="badge badge-neutral">{history.length} quotes</span>
        </div>
        <div className="chart-frame">
          <LineChart data={history} lines={chartLines} height={280} />
        </div>
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
            <h2 className="section-title">Stored quotes</h2>
            <p className="section-sub">Latest local prices, estimated world value, premium, and reporting lag.</p>
          </div>
        </div>
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Quote date</th>
                <th scope="col">Pettah 22K (8g)</th>
                <th scope="col">World equivalent</th>
                <th scope="col">Premium</th>
                <th scope="col">Lag</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(-10).reverse().map((quote) => (
                <tr key={quote.date}>
                  <td>{quote.date}</td>
                  <td>{lkr(quote.local)}</td>
                  <td>{lkr(quote.local_equiv)}</td>
                  <td>{pct(quote.premium)}</td>
                  <td>{quote.lag_days} days</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={5}>No quote history available yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
