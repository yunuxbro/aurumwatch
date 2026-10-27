import { getData } from "@/lib/data";
import { pct, lkr } from "@/lib/format";
import Banner from "@/components/Banner";
import JewellerCalculator from "@/components/JewellerCalculator";

export const dynamic = "force-dynamic";

export default function Home() {
  const risk = getData("risk")?.h7 || {};
  const flags = getData("anomalies") || [];
  const history = getData("history") || [];
  const lastMove = flags.length > 0 ? flags.at(-1) : null;
  const lastHistory = history.length > 0 ? history.at(-1) : null;
  const q = risk.range_8g;

  const currentPrice = lastHistory?.local || risk?.start_price_8g || 363400;
  const worldEquivPrice = lastHistory?.local_equiv || 350777;
  const premiumPct = lastHistory?.premium != null ? lastHistory.premium : 0.035;
  const premiumLkrDiff = currentPrice - worldEquivPrice;

  return (
    <div className="space-y-6">
      {/* Safety Notice Banner if stale quote */}
      <Banner risk={risk} />

      {/* Top Gold Ingot Anchor Plaque */}
      <div className="skeuo-gold-card p-6">
        <div className="rivet gold rivet-tl" />
        <div className="rivet gold rivet-tr" />
        <div className="rivet gold rivet-bl" />
        <div className="rivet gold rivet-br" />

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-amber-400 font-bold">
                BENCHMARK QUOTE · COLOMBO PETTAH
              </span>
              <span className="rounded bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300 border border-amber-500/30">
                22 KARAT SOVEREIGN (8g)
              </span>
            </div>
            <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-yellow-200 to-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              Daily Gold Risk Brief
            </h1>
          </div>

          <div className="flex flex-col items-end text-right">
            <span className="flex items-center gap-1.5 font-mono text-xs text-stone-300">
              <span className="led-indicator led-green" />
              PETTAH QUOTE: <b>{risk.quote_date || lastHistory?.date || "2026-05-06"}</b>
            </span>
            <span className="font-mono text-[11px] text-stone-400">
              WORLD MARKET: {risk.market_date || "2026-10-27"}
            </span>
          </div>
        </div>

        {/* 3 Metric Ingot Columns */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Observed Local Quote */}
          <div className="skeuo-screen p-4 text-center">
            <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400/80">
              Observed Pettah Quote (D3)
            </span>
            <p className="mt-1 font-mono text-2xl font-black text-amber-300 drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]">
              {lkr(currentPrice)}
            </p>
            <p className="mt-1 text-[11px] text-stone-400">
              Per 8 g (22K) Sovereign
            </p>
          </div>

          {/* Theoretical World-Equiv Price */}
          <div className="skeuo-screen p-4 text-center">
            <span className="font-mono text-[10px] uppercase tracking-wider text-sky-400/80">
              World-Equiv Reference (D1×D2)
            </span>
            <p className="mt-1 font-mono text-2xl font-black text-sky-200">
              {lkr(worldEquivPrice)}
            </p>
            <p className="mt-1 text-[11px] text-stone-400">
              GC=F Futures converted to LKR
            </p>
          </div>

          {/* Domestic Pettah Premium */}
          <div className="skeuo-screen p-4 text-center">
            <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400/80">
              Domestic Premium Residual
            </span>
            <p className="mt-1 font-mono text-2xl font-black text-amber-400">
              {pct(premiumPct)}
            </p>
            <p className="mt-1 text-[11px] text-stone-400">
              Diff: +{lkr(premiumLkrDiff)} / 8g
            </p>
          </div>
        </div>
      </div>

      {/* Output 1: Component Decomposition (What Drove the Last Move) */}
      <section className="skeuo-card p-6">
        <div className="rivet rivet-tl" />
        <div className="rivet rivet-tr" />
        <div className="rivet rivet-bl" />
        <div className="rivet rivet-br" />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-stone-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-400 border border-stone-700">
                OUTPUT 1
              </span>
              <h2 className="font-serif text-lg font-bold text-stone-100 tracking-wide">
                Price-Component Attribution Identity
              </h2>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Exact log-decomposition of the observed local price move: Δln(Local) = Δln(World) + Δln(USD/LKR) + Δln(Premium)
            </p>
          </div>
          {lastMove?.date && (
            <span className="font-mono text-xs text-amber-400/90 rounded border border-stone-700 bg-stone-900/60 px-2 py-1">
              OBSERVATION: {lastMove.date}
            </span>
          )}
        </div>

        {lastMove ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Local Net Move */}
            <div className="skeuo-screen p-3 text-center border-amber-500/30">
              <span className="font-mono text-[10px] text-amber-400 uppercase tracking-wider">
                Total Local Move
              </span>
              <p className="mt-1 font-mono text-xl font-bold text-amber-300">
                {lastMove.ret_local > 0 ? "▲ " : lastMove.ret_local < 0 ? "▼ " : ""}{pct(lastMove.ret_local)}
              </p>
              <p className="text-[10px] text-stone-500 font-mono mt-0.5">Observed in Pettah</p>
            </div>

            {/* World Gold Contribution */}
            <div className="skeuo-screen p-3 text-center">
              <span className="font-mono text-[10px] text-stone-400 uppercase tracking-wider">
                1. World Gold (D1)
              </span>
              <p className="mt-1 font-mono text-xl font-bold text-stone-200">
                {lastMove.ret_world > 0 ? "▲ " : lastMove.ret_world < 0 ? "▼ " : ""}{pct(lastMove.ret_world)}
              </p>
              <p className="text-[10px] text-stone-500 font-mono mt-0.5">International USD/oz</p>
            </div>

            {/* USD/LKR Contribution */}
            <div className="skeuo-screen p-3 text-center">
              <span className="font-mono text-[10px] text-stone-400 uppercase tracking-wider">
                2. USD / LKR (D2)
              </span>
              <p className="mt-1 font-mono text-xl font-bold text-stone-200">
                {lastMove.ret_fx > 0 ? "▲ " : lastMove.ret_fx < 0 ? "▼ " : ""}{pct(lastMove.ret_fx)}
              </p>
              <p className="text-[10px] text-stone-500 font-mono mt-0.5">Exchange rate impact</p>
            </div>

            {/* Local Premium Contribution */}
            <div className="skeuo-screen p-3 text-center">
              <span className="font-mono text-[10px] text-stone-400 uppercase tracking-wider">
                3. Pettah Premium (D3)
              </span>
              <p className="mt-1 font-mono text-xl font-bold text-amber-400">
                {lastMove.ret_premium > 0 ? "▲ " : lastMove.ret_premium < 0 ? "▼ " : ""}{pct(lastMove.ret_premium)}
              </p>
              <p className="text-[10px] text-stone-500 font-mono mt-0.5">Domestic markup delta</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-stone-400 p-4 text-center font-mono">
            Insufficient consecutive quote history to calculate decomposition.
          </p>
        )}
      </section>

      {/* Output 3: Abnormal Local-Premium Detector (Outlier Jewel Gauge) */}
      <section className="skeuo-card p-6">
        <div className="rivet rivet-tl" />
        <div className="rivet rivet-tr" />
        <div className="rivet rivet-bl" />
        <div className="rivet rivet-br" />

        <div className="flex items-start gap-4">
          <div className="mt-1">
            <span
              className={`led-indicator ${
                !lastMove || lastMove.status === "cannot_assess"
                  ? "led-amber"
                  : lastMove.flag
                  ? "led-red"
                  : "led-green"
              }`}
            />
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-stone-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-400 border border-stone-700">
                  OUTPUT 3
                </span>
                <h2 className="font-serif text-lg font-bold text-stone-100 tracking-wide">
                  Abnormal Local-Premium Outlier Detector
                </h2>
              </div>
              <span className="font-mono text-xs text-stone-400">
                MAD Robust Z-Score Rule (Cut-off: |z| &gt; 3.5)
              </span>
            </div>

            {!lastMove || lastMove.status === "cannot_assess" ? (
              <p className="text-sm text-amber-300/80 font-mono">
                Cannot assess yet: Requires at least 5 recent local price observations.
              </p>
            ) : lastMove.flag ? (
              <div className="rounded border border-red-500/40 bg-red-950/20 p-3">
                <p className="text-sm font-bold text-red-400">
                  ⚠️ ABNORMAL LOCAL PREMIUM DETECTED (z = {lastMove.z?.toFixed(2)})
                </p>
                <p className="mt-1 text-xs text-stone-300">
                  The local premium moved far more than usual relative to its recent median absolute deviation.
                  As stated in the research methodology, this indicates an unusual local market condition that warrants checking, not a certainty of market collapse.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded border border-emerald-500/30 bg-emerald-950/20 p-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    ✓ NORMAL: Premium move is within historical tolerance
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Robust z-score is {lastMove.z != null ? lastMove.z.toFixed(2) : "0.00"}, below the 3.5 anomaly threshold.
                  </p>
                </div>
                <span className="rounded bg-emerald-500/20 px-2 py-1 font-mono text-xs font-bold text-emerald-300 border border-emerald-500/40">
                  STABLE
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Output 2: Interactive Jeweller's Stock Exposure Calculator */}
      <JewellerCalculator
        initialPrice={currentPrice}
        riskData={risk}
      />
    </div>
  );
}
