import { getData } from "@/lib/data";
import { pct, lkr } from "@/lib/format";
import Banner from "@/components/Banner";
import JewellerCalculator from "@/components/JewellerCalculator";

export const dynamic = "force-dynamic";
const LEVELS = [1, 5, 25, 50, 75, 95, 99];

function Block({ r, title }) {
  if (!r) return null;
  return (
    <section className="skeuo-card p-6">
      <div className="rivet rivet-tl" />
      <div className="rivet rivet-tr" />
      <div className="rivet rivet-bl" />
      <div className="rivet rivet-br" />

      <div className="flex flex-wrap items-center justify-between border-b border-stone-800 pb-3 mb-4">
        <h2 className="font-serif text-lg font-bold text-amber-200">{title}</h2>
        <span className="font-mono text-xs text-stone-400">
          Starting Price: <b className="text-amber-300">{lkr(r.start_price_8g)}</b> / 8 g ({r.quote_date})
        </span>
      </div>

      {r.status !== "ok" ? (
        <div className="rounded border border-red-500/30 bg-red-950/20 p-4">
          <p className="text-sm text-red-300 font-mono">
            Safety Trigger: Cannot assess without fresh quotes. {r.notes?.join(" ") || ""}
          </p>
          <p className="text-xs text-stone-400 mt-2">
            Use the interactive stock exposure simulator below to compute custom risk intervals on today&apos;s prices.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-stone-800 text-left text-xs uppercase text-stone-400">
                  <th className="py-2">Quantile (Outcomes Below)</th>
                  <th>Per 8 g Sovereign</th>
                  <th>1 kg Stock Exposure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                {LEVELS.map((n) => (
                  <tr
                    key={n}
                    className={
                      n === 5
                        ? "bg-red-950/20 text-red-300 font-bold"
                        : n === 50
                        ? "bg-amber-500/10 text-amber-200 font-semibold"
                        : "text-stone-300"
                    }
                  >
                    <td className="py-2">
                      {n}% {n === 5 ? "← 5% Downside Tail" : n === 50 ? "← Most Likely Median" : ""}
                    </td>
                    <td>{lkr(r.range_8g?.[`p${n}`])}</td>
                    <td>{lkr(r.stock_1kg_lkr?.[`p${n}`])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-stone-800 pt-3">
            <div className="skeuo-screen p-3 text-xs">
              <span className="text-stone-400 font-mono">Downside Probability:</span>
              <p className="mt-1 font-mono text-stone-200">
                Fall &gt;5%: <b className="text-amber-300">{pct(r.prob_fall_5pct, 0)}</b> · Fall &gt;10%: <b className="text-amber-300">{pct(r.prob_fall_10pct, 0)}</b>
              </p>
            </div>
            <div className="skeuo-screen p-3 text-xs">
              <span className="text-stone-400 font-mono">Premium Stress Case:</span>
              <p className="mt-1 font-mono text-stone-200">
                Worst historical move: <b className="text-red-300">{lkr(r.premium_stress_8g)}</b> / 8 g
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default function RiskPage() {
  const risk = getData("risk") || {};
  const h7 = risk.h7;
  const h14 = risk.h14;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between border-b border-stone-800 pb-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-amber-200">Stock Risk Simulations</h1>
          <p className="text-xs text-stone-400">
            Filtered Historical Simulation (EWMA Volatility Scaled Resampling)
          </p>
        </div>
        <span className="font-mono text-xs text-stone-400 rounded border border-stone-800 bg-[#121620] px-2 py-1">
          OUTPUT 2 (PDF SECTION 4)
        </span>
      </div>

      <Banner risk={h7} />

      {/* Interactive Jeweller Simulator */}
      <JewellerCalculator
        initialPrice={h7?.start_price_8g || 363400}
        riskData={risk}
      />

      <Block r={h7} title="7-Day Restocking Horizon (Pre-calculated Model Baseline)" />
      <Block r={h14} title="14-Day Restocking Horizon (Pre-calculated Model Baseline)" />

      {/* Assumptions Plaque */}
      <section className="skeuo-card p-5 text-xs">
        <div className="rivet rivet-tl" />
        <div className="rivet rivet-tr" />
        <div className="rivet rivet-bl" />
        <div className="rivet rivet-br" />

        <h2 className="font-serif font-bold text-amber-300 mb-2 text-sm">
          Limits &amp; Assumptions of this Range (PDF Section 6 &amp; 10)
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-stone-300 leading-relaxed">
          {(h7?.assumptions || []).map((a) => (
            <li key={a}>{a}</li>
          ))}
          <li>
            Non-financial advice notice: The simulated range is an empirical estimate of uncertainty based on historical data. It does not predict future prices with certainty.
          </li>
        </ul>
      </section>
    </div>
  );
}