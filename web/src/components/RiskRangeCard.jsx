import { lkr } from "@/lib/format";

const LEVELS = [1, 5, 25, 50, 75, 95, 99];

export default function RiskRangeCard({ risk, title = "Stock Risk range" }) {
  return (
    <section className="card panel">
      <div className="section-header">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-sub">
            Starting baseline: {lkr(risk?.start_price_8g)} per 8 g · {risk?.quote_date || "date unavailable"} · {risk?.start_source || "source unavailable"}
            {risk?.start_source === "current Sri Lankan 22K dealer median" && Number.isFinite(risk?.dealer_quote_count) && ` · ${risk.dealer_quote_count} shops`}
          </p>
        </div>
        <span className={`badge ${risk?.status === "ok" ? "badge-success" : "badge-warning"}`}>
          {risk?.status === "ok" ? "Model range available" : "Cannot assess"}
        </span>
      </div>

      {risk?.status !== "ok" ? (
        <div className="risk-callout" style={{ padding: "1rem" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>
            Fresh quotes are required before the model can provide this range.
          </p>
          {risk?.notes?.length > 0 && (
            <p style={{ margin: ".45rem 0 0", color: "var(--text-secondary)" }}>
              {risk.notes.join(" ")}
            </p>
          )}
        </div>
      ) : (
        <div className="scroll-x">
          <table className="risk-table">
            <thead>
              <tr><th scope="col">Percentile</th><th scope="col">Per 8 g</th><th scope="col">1 kg exposure</th></tr>
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
      )}
    </section>
  );
}
