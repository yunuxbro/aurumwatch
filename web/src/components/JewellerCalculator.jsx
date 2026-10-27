"use client";

import { useState } from "react";
import { lkr, pct } from "@/lib/format";

// Preset weights for Sri Lankan jewellers (8g = 1 sovereign)
const WEIGHT_PRESETS = [
  { label: "1 Sov (8g)", grams: 8 },
  { label: "5 Sov (40g)", grams: 40 },
  { label: "10 Sov (80g)", grams: 80 },
  { label: "250g", grams: 250 },
  { label: "500g", grams: 500 },
  { label: "1 kg", grams: 1000 },
];

export default function JewellerCalculator({ initialPrice = 363400, riskData = {} }) {
  const [horizon, setHorizon] = useState(7); // 7 or 14 days
  const [karat, setKarat] = useState(22); // 22K or 24K
  const [stockGrams, setStockGrams] = useState(80); // Default 10 sovereigns (80g)
  const [customPrice, setCustomPrice] = useState(initialPrice);

  // Model-calibrated return factors based on empirical EWMA & Filtered Historical Simulation (from backtest.py)
  // For h=7 days: 95% range: [p5, p50, p95] -> roughly [-6.8%, +0.1%, +7.1%]
  // For h=14 days: 95% range: [p5, p50, p95] -> roughly [-9.8%, +0.2%, +10.0%]
  const modelFactors = {
    7: {
      p1: 0.902,
      p5: 0.932,
      p50: 1.001,
      p95: 1.071,
      p99: 1.108,
      probFall5: 0.168,
      probFall10: 0.032,
      worstPremiumMove: -0.0812, // -8.12% worst observed premium drop
    },
    14: {
      p1: 0.865,
      p5: 0.902,
      p50: 1.002,
      p95: 1.102,
      p99: 1.152,
      probFall5: 0.245,
      probFall10: 0.076,
      worstPremiumMove: -0.0812,
    },
  };

  const factors = modelFactors[horizon] || modelFactors[7];

  // Sovereign calculation: 8g of 22K is 1 standard Pettah sovereign.
  // 24K purity adjustment: 24/22 multiplier
  const karatMultiplier = karat === 24 ? 24 / 22 : 1.0;
  const pricePer8g = customPrice * karatMultiplier;
  const numSovereigns = stockGrams / 8;
  const currentTotalValuation = numSovereigns * pricePer8g;

  // Simulated Outcomes
  const valP50 = currentTotalValuation * factors.p50;
  const valP5 = currentTotalValuation * factors.p5; // 5% worst case downside
  const valP95 = currentTotalValuation * factors.p95;
  const maxDownsideLkr = currentTotalValuation - valP5;

  // Premium stress scenario
  const premiumStressValuation = currentTotalValuation * Math.exp(factors.worstPremiumMove);
  const premiumStressLoss = currentTotalValuation - premiumStressValuation;

  return (
    <div className="skeuo-gold-card p-5 sm:p-6 mb-6">
      <div className="rivet gold rivet-tl" />
      <div className="rivet gold rivet-tr" />
      <div className="rivet gold rivet-bl" />
      <div className="rivet gold rivet-br" />

      {/* Header Plate */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-[11px] font-black text-black shadow-md">
            ⚖
          </span>
          <h2 className="font-serif text-base sm:text-lg font-bold text-amber-200 tracking-wide drop-shadow-sm">
            JEWELLER&apos;S STOCK EXPOSURE SIMULATOR
          </h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400/90 rounded border border-amber-500/30 bg-amber-950/40 px-2 py-0.5">
          SESSION MEMORY ONLY · NOT STORED ON SERVER
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Controls */}
        <div className="lg:col-span-6 space-y-4">
          {/* Restocking Horizon Selector (7 vs 14 Days) */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-stone-300">
              <span>Restocking Interval</span>
              <span className="font-mono text-amber-400">{horizon} Days Window</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[7, 14].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizon(h)}
                  className={`skeuo-btn py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${
                    horizon === h ? "active text-amber-300 border-amber-500/60" : "text-stone-300"
                  }`}
                >
                  <span className={`led-indicator ${horizon === h ? "led-amber" : "bg-stone-700 border-stone-800"}`} />
                  {h} Days Cycle
                </button>
              ))}
            </div>
          </div>

          {/* Karat Selection (22K vs 24K) */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-stone-300">
              <span>Gold Purity / Karat</span>
              <span className="font-mono text-amber-400">{karat} Karat ({karat === 22 ? "91.6% Sovereign" : "99.9% Pure"})</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[22, 24].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKarat(k)}
                  className={`skeuo-btn py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${
                    karat === k ? "active text-amber-300 border-amber-500/60" : "text-stone-300"
                  }`}
                >
                  <span className={`led-indicator ${karat === k ? "led-amber" : "bg-stone-700 border-stone-800"}`} />
                  {k}K Gold {k === 22 ? "(Sovereign)" : "(Bullion)"}
                </button>
              ))}
            </div>
          </div>

          {/* Stock Weight Presets & Input */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-stone-300">
              <span>Stock Inventory Weight</span>
              <span className="font-mono text-amber-400">
                {stockGrams} g ({(stockGrams / 8).toFixed(1)} Sovereigns)
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
              {WEIGHT_PRESETS.map((p) => (
                <button
                  key={p.grams}
                  type="button"
                  onClick={() => setStockGrams(p.grams)}
                  className={`skeuo-btn py-1.5 text-[11px] font-mono tracking-tight ${
                    stockGrams === p.grams ? "active text-amber-300 border-amber-500/60 font-bold" : "text-stone-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Custom Slider */}
            <input
              type="range"
              min="8"
              max="1500"
              step="4"
              value={stockGrams}
              onChange={(e) => setStockGrams(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-2 bg-[#0c0f16] rounded-lg border border-amber-500/30"
            />
          </div>

          {/* Today's Sovereign Price Input */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-stone-300">
              <span>Today&apos;s 22K Sovereign Benchmark</span>
              <span className="font-mono text-[11px] text-stone-400">Pettah 8 g rate</span>
            </label>
            <div className="skeuo-screen p-2 flex items-center justify-between">
              <span className="font-mono text-xs text-amber-400/80 pl-2">LKR</span>
              <input
                type="number"
                step="500"
                value={customPrice}
                onChange={(e) => setCustomPrice(Number(e.target.value) || 0)}
                className="w-44 bg-transparent text-right font-mono text-sm font-bold text-amber-300 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Precision Scale Display (OLED Gauges) */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          {/* Main OLED Valuation Display */}
          <div className="skeuo-scale-display p-4 text-center">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2 mb-3">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-amber-400/70 tracking-widest">
                <span className="led-indicator led-green" />
                VALUATION SCALE READOUT
              </span>
              <span className="font-mono text-[10px] text-amber-500/80">
                {stockGrams}g @ {lkr(pricePer8g)}/8g
              </span>
            </div>

            <p className="font-mono text-[11px] uppercase tracking-wider text-amber-200/60">
              Current Held Inventory Value
            </p>
            <div className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)] my-1">
              {lkr(currentTotalValuation)}
            </div>
            <p className="font-mono text-[11px] text-amber-400/80">
              Sri Lankan Rupees ({numSovereigns.toFixed(1)} {karat}K Sovereigns)
            </p>
          </div>

          {/* 95% Risk Range & 5% Tail Risk Inset */}
          <div className="skeuo-screen p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
              <span className="font-mono text-xs font-bold text-stone-300">
                {horizon}-Day Simulated 95% Interval
              </span>
              <span className="font-mono text-[10px] text-stone-500">EWMA Resampling</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-[#10141d] p-2 border border-red-500/20">
                <p className="font-mono text-[10px] text-red-400 uppercase">Worst 5% Case</p>
                <p className="font-mono text-xs font-bold text-red-300 mt-0.5">{lkr(valP5)}</p>
                <p className="font-mono text-[10px] text-red-400/80">-{pct(1 - factors.p5)}</p>
              </div>

              <div className="rounded bg-[#10141d] p-2 border border-stone-700/40">
                <p className="font-mono text-[10px] text-stone-400 uppercase">Expected Central</p>
                <p className="font-mono text-xs font-bold text-stone-200 mt-0.5">{lkr(valP50)}</p>
                <p className="font-mono text-[10px] text-stone-400">+{pct(factors.p50 - 1)}</p>
              </div>

              <div className="rounded bg-[#10141d] p-2 border border-emerald-500/20">
                <p className="font-mono text-[10px] text-emerald-400 uppercase">Best 95% Case</p>
                <p className="font-mono text-xs font-bold text-emerald-300 mt-0.5">{lkr(valP95)}</p>
                <p className="font-mono text-[10px] text-emerald-400/80">+{pct(factors.p95 - 1)}</p>
              </div>
            </div>

            {/* Downside VaR Highlight */}
            <div className="flex items-center justify-between rounded bg-red-950/20 border border-red-500/30 px-3 py-2 text-xs">
              <div className="flex items-center gap-2 text-red-300">
                <span className="led-indicator led-red" />
                <span>95% Downside Value-at-Risk:</span>
              </div>
              <span className="font-mono font-bold text-red-300">
                - {lkr(maxDownsideLkr)}
              </span>
            </div>

            {/* Probability Gauge */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-stone-400 pt-1">
              <div>
                <span>Chance of &gt;5% decline: </span>
                <b className="text-amber-300">{pct(factors.probFall5, 0)}</b>
              </div>
              <div>
                <span>Chance of &gt;10% decline: </span>
                <b className="text-amber-300">{pct(factors.probFall10, 0)}</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Disclaimer Footer (Mandatory per PDF page 3 & 6) */}
      <div className="mt-4 pt-3 border-t border-amber-500/20 flex flex-wrap items-center justify-between text-[11px] text-amber-200/60 font-mono">
        <span>* Model estimate only. Not guaranteed or buy/sell advice.</span>
        <span>Experimental premium stress loss: -{lkr(premiumStressLoss)}</span>
      </div>
    </div>
  );
}

