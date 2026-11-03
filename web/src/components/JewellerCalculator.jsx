"use client";
import { useState } from "react";
import { lkr, pct } from "@/lib/format";

const WEIGHT_PRESETS = [
  { label: "1 Sov (8g)",  grams: 8 },
  { label: "5 Sov (40g)", grams: 40 },
  { label: "10 Sov (80g)",grams: 80 },
  { label: "250 g",       grams: 250 },
  { label: "500 g",       grams: 500 },
  { label: "1 kg",        grams: 1000 },
];

const MODEL = {
  7:  { p5: 0.932, p50: 1.001, p95: 1.071, fall5: 0.168, fall10: 0.032, worstPremium: -0.0812 },
  14: { p5: 0.902, p50: 1.002, p95: 1.102, fall5: 0.245, fall10: 0.076, worstPremium: -0.0812 },
};

function Metric({ label, value, sub, valueStyle }) {
  return (
    <div className="metric-tile">
      <p className="stat-label" style={{ marginBottom: "0.4rem" }}>{label}</p>
      <p className="stat-value" style={{ fontSize: "1.3rem", ...valueStyle }}>{value}</p>
      {sub && <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>{sub}</p>}
    </div>
  );
}

export default function JewellerCalculator({
  initialPrice = null,
  initialPriceLabel = "22K price input",
}) {
  const [horizon, setHorizon]     = useState(7);
  const [karat, setKarat]         = useState(22);
  const [grams, setGrams]         = useState(80);
  const [price, setPrice]         = useState(initialPrice);
  const hasPrice = Number.isFinite(price) && price > 0;

  const f                = MODEL[horizon];
  const karatMult        = karat === 24 ? 24 / 22 : 1;
  const pricePer8g       = hasPrice ? price * karatMult : null;
  const sovereigns       = grams / 8;
  const totalValue       = hasPrice ? sovereigns * pricePer8g : null;
  const valP5            = totalValue == null ? null : totalValue * f.p5;
  const valP50           = totalValue == null ? null : totalValue * f.p50;
  const valP95           = totalValue == null ? null : totalValue * f.p95;
  const varDownside      = totalValue == null ? null : totalValue - valP5;
  const premiumStressLoss= totalValue == null ? null : totalValue * (1 - Math.exp(f.worstPremium));

  const s = {
    card: {
      backgroundColor: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-md)",
      overflow: "hidden",
    },
    goldHeader: {
      background: "linear-gradient(135deg, var(--gold-subtle), var(--surface-2))",
      borderBottom: "1px solid var(--gold-border)",
      padding: "1rem 1.25rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "0.75rem",
      flexWrap: "wrap",
    },
    body: { padding: "1.25rem" },
    label: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: "0.75rem",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: "var(--text-muted)",
      marginBottom: "0.5rem",
    },
    value: { color: "var(--gold-dark)", fontWeight: 700 },
    presetGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "0.4rem",
      marginBottom: "0.75rem",
    },
    inset: {
      backgroundColor: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-sm)",
      padding: "0.5rem 0.75rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
  };

  return (
    <div className="calculator-shell" style={s.card}>
      {/* Gold header stripe */}
      <div className="gold-bar" />

      {/* Card header */}
      <div className="calculator-header" style={s.goldHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.2rem" }}>⚖</span>
          <div>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Jeweller&apos;s Stock Exposure Simulator
            </h2>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0 }}>
              Session memory only — not stored on server
            </p>
          </div>
        </div>
        <span className="badge badge-gold">OUTPUT 2</span>
      </div>

      <div className="calculator-body" style={{ ...s.body, display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>

          {/* ── Controls ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>

            {/* Restocking horizon */}
            <div>
              <div style={s.label}>
                <span>Restocking Horizon</span>
                <span style={s.value}>{horizon}-Day Window</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {[7, 14].map((h) => (
                  <button key={h} type="button" onClick={() => setHorizon(h)}
                    className={`btn btn-toggle ${horizon === h ? "active" : ""}`}
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", justifyContent: "center" }}>
                    <span className={`led ${horizon === h ? "led-amber" : "led-neutral"}`} />
                    {h} Days
                  </button>
                ))}
              </div>
            </div>

            {/* Karat */}
            <div>
              <div style={s.label}>
                <span>Gold Karat</span>
                <span style={s.value}>{karat}K — {karat === 22 ? "91.6%" : "99.9%"} purity</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {[22, 24].map((k) => (
                  <button key={k} type="button" onClick={() => setKarat(k)}
                    className={`btn btn-toggle ${karat === k ? "active" : ""}`}
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", justifyContent: "center" }}>
                    <span className={`led ${karat === k ? "led-amber" : "led-neutral"}`} />
                    {k}K {k === 22 ? "Sovereign" : "Bullion"}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock weight */}
            <div>
              <div style={s.label}>
                <span>Stock Weight</span>
                <span style={s.value}>{grams} g · {sovereigns.toFixed(1)} Sovereigns</span>
              </div>
              <div style={s.presetGrid}>
                {WEIGHT_PRESETS.map((p) => (
                  <button key={p.grams} type="button" onClick={() => setGrams(p.grams)}
                    className={`btn btn-toggle ${grams === p.grams ? "active" : ""}`}
                    style={{ fontSize: "0.72rem", padding: "0.35rem 0.5rem" }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <input type="range" min="8" max="1500" step="4" value={grams}
                onChange={(e) => setGrams(Number(e.target.value))}
                style={{ width: "100%", marginTop: "0.25rem" }} />
            </div>

            {/* Starting quote */}
            <div>
              <div style={s.label}>
                <span>{initialPriceLabel}</span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>22K per 8 g</span>
              </div>
              <div style={s.inset}>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "monospace" }}>LKR</span>
                <input type="number" step="500" value={price ?? ""}
                  onChange={(e) => setPrice(e.target.value === "" ? null : Number(e.target.value))}
                  className="input"
                  style={{ width: "180px", textAlign: "right", background: "transparent",
                    border: "none", boxShadow: "none", fontWeight: 700, color: "var(--gold-dark)",
                    fontSize: "1rem", fontFamily: "monospace" }}
                  aria-label={`${initialPriceLabel}, LKR per 8 grams`} />
              </div>
              {!hasPrice && (
                <p className="section-sub">Enter a current 22K price per 8 g to calculate LKR exposure.</p>
              )}
            </div>
          </div>

          {/* ── Readout ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Total valuation */}
            <div className="card-gold" style={{ padding: "1.25rem", textAlign: "center" }}>
              <p className="stat-label" style={{ marginBottom: "0.3rem" }}>Current Inventory Value</p>
              <p style={{
                fontSize: "2rem",
                fontWeight: 900,
                color: "var(--gold-dark)",
                margin: "0.1rem 0",
                fontFamily: "monospace",
              }}>
                {lkr(totalValue)}
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {sovereigns.toFixed(1)} × {karat}K Sovereigns · {lkr(pricePer8g)} / 8g
              </p>
            </div>

            {/* 95% range */}
            <div className="card-inset" style={{ padding: "1rem" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)",
                marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {horizon}-Day Simulated 95% Range
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                {[
                  { label: "Worst 5%", val: valP5,  pct: pct(1 - f.p5),        style: { color: "var(--danger)" } },
                  { label: "Median",   val: valP50, pct: "+"+pct(f.p50 - 1),   style: { color: "var(--text-primary)" } },
                  { label: "Best 95%", val: valP95, pct: "+"+pct(f.p95 - 1),   style: { color: "var(--success)" } },
                ].map((item) => (
                  <div key={item.label} style={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "0.6rem",
                    textAlign: "center",
                  }}>
                    <p className="stat-label" style={{ marginBottom: "0.2rem" }}>{item.label}</p>
                    <p style={{ fontSize: "0.8rem", fontWeight: 700, fontFamily: "monospace", ...item.style }}>{lkr(item.val)}</p>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{item.pct}</p>
                  </div>
                ))}
              </div>

              {/* VaR row */}
              <div style={{
                marginTop: "0.75rem",
                padding: "0.6rem 0.8rem",
                backgroundColor: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.8rem",
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--danger)" }}>
                  <span className="led led-red" /> 95% Value-at-Risk
                </span>
                <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--danger)" }}>
                  −{lkr(varDownside)}
                </span>
              </div>

              {/* Probabilities */}
              <div style={{ marginTop: "0.6rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {[
                  { label: "P(fall > 5%)",  v: pct(f.fall5,  0) },
                  { label: "P(fall > 10%)", v: pct(f.fall10, 0) },
                ].map((row) => (
                  <div key={row.label} style={{ fontSize: "0.78rem", color: "var(--text-secondary)", textAlign: "center" }}>
                    {row.label}: <strong style={{ color: "var(--gold-dark)" }}>{row.v}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
          * Model estimate only — not financial advice and not a guaranteed prediction.
          Experimental premium stress loss (worst observed move): −{lkr(premiumStressLoss)}
        </p>
      </div>
    </div>
  );
}
