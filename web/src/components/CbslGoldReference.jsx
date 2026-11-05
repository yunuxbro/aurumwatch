"use client";

import { useCallback, useEffect, useState } from "react";
import { lkr } from "@/lib/format";

const KARATS = [24, 22, 18];

export default function CbslGoldReference() {
  const [quote, setQuote] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/cbsl-gold", { cache: "no-store", signal: AbortSignal.timeout(12_000) });
      const result = await response.json();
      if (!response.ok || result.status !== "available") throw new Error(result.message || "CBSL gold rate is unavailable.");
      setQuote(result);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <section className="card panel cbsl-reference-card" aria-label="Central Bank gold reference">
      <div className="section-header">
        <div>
          <h2 className="section-title">CBSL gold reference</h2>
          <p className="section-sub">
            Daily indicative gold rate, shown separately from dealer listings and the Yahoo market benchmark.
          </p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={refresh} disabled={loading}>
          {loading ? "Updating…" : "Refresh CBSL rate"}
        </button>
      </div>
      {quote ? (
        <>
          {message && <p className="refresh-error" role="status">CBSL gold provider unavailable. Showing the last value from {quote.rate_date}. {message}</p>}
          <div className="metric-grid">
            {KARATS.map((karat) => (
              <div className="metric-tile" key={karat}>
                <span className="stat-label">{karat}K · LKR / 8 g</span>
                <p className="stat-value">{lkr(quote.lkr_per_8g[`${karat}k`])}</p>
              </div>
            ))}
          </div>
          <p className="section-sub" style={{ marginTop: ".75rem" }}>
            Rs {Number(quote.gold_lkr_per_troy_ounce).toLocaleString("en-LK", { maximumFractionDigits: 2 })} per troy ounce · rate date {quote.rate_date}
            {quote.usd_lkr ? ` · CBSL USD/LKR Rs ${quote.usd_lkr.toFixed(4)}` : ""} · {" "}
            <a href={quote.source_url} target="_blank" rel="noreferrer">CBSL source</a>{" · "}
            <a href={quote.attribution_url} target="_blank" rel="noreferrer">API attribution</a>
          </p>
          <p className="section-sub">
            22K and 18K values are purity conversions from CBSL&apos;s 24K ounce reference, not dealer-published prices.
          </p>
        </>
      ) : (
        <p className={message ? "refresh-error" : "section-sub"} role="status">
          {message ? `CBSL gold provider unavailable. ${message}` : "Fetching the latest CBSL indicative gold rate…"}
        </p>
      )}
    </section>
  );
}
