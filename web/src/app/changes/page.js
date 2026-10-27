import { getData } from "@/lib/data";
import { pct, lkr } from "@/lib/format";
import LineChart from "@/components/LineChart";

export const dynamic = "force-dynamic";

export default function ChangesPage() {
  const history = getData("history") || [];
  const moves = getData("moves") || [];

  const chartLines = [
    { key: "local", label: "Pettah 22K (8g)", color: "#f59e0b" },
    { key: "local_equiv", label: "World Equiv in LKR (8g)", color: "#38bdf8" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between border-b border-stone-800 pb-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-amber-200">Historical Moves &amp; Decomposition</h1>
          <p className="text-xs text-stone-400">
            Pettah market prices versus theoretical world-equivalent prices (Output 1 &amp; Output 3)
          </p>
        </div>
        <span className="font-mono text-xs text-stone-400 rounded border border-stone-800 bg-[#121620] px-2 py-1">
          PDF OUTPUT 1 (WHAT CHANGED)
        </span>
      </div>

      {/* Chart Section */}
      <section className="skeuo-card p-6">
        <div className="rivet rivet-tl" />
        <div className="rivet rivet-tr" />
        <div className="rivet rivet-bl" />
        <div className="rivet rivet-br" />

        <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-amber-200">
              Price History Chart: Pettah 22K vs. World Equivalent
            </h2>
            <p className="text-xs text-stone-400">
              Units: LKR per 8 g sovereign. Comparing domestic price against international market value.
            </p>
          </div>
          <span className="font-mono text-xs text-amber-400">
            {history.length} Historic Quotes
          </span>
        </div>

        <div className="skeuo-screen p-4">
          <LineChart data={history} lines={chartLines} height={260} />
        </div>
      </section>

      {/* Decomposition Table */}
      <section className="skeuo-card p-6">
        <div className="rivet rivet-tl" />
        <div className="rivet rivet-tr" />
        <div className="rivet rivet-bl" />
        <div className="rivet rivet-br" />

        <div className="border-b border-stone-800 pb-3 mb-4">
          <h2 className="font-serif text-lg font-bold text-amber-200">
            Decomposition of Recent Price Moves
          </h2>
          <p className="text-xs text-stone-400">
            Accounting identity: Δln(Local) = Δln(World Gold) + Δln(USD/LKR) + Δln(Local Premium)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-stone-800 text-left text-xs uppercase text-stone-400">
                <th className="py-2">Date</th>
                <th>Observed Local Move</th>
                <th>World Gold (USD)</th>
                <th>USD / LKR</th>
                <th>Local Premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {moves.slice(-10).reverse().map((m) => (
                <tr key={m.date} className="hover:bg-stone-800/20">
                  <td className="py-2 text-stone-300 font-bold">{m.date}</td>
                  <td className="font-bold text-amber-300">
                    {m.ret_local > 0 ? "▲ " : m.ret_local < 0 ? "▼ " : ""}{pct(m.ret_local)}
                  </td>
                  <td className="text-stone-300">
                    {m.ret_world > 0 ? "▲ " : m.ret_world < 0 ? "▼ " : ""}{pct(m.ret_world)}
                  </td>
                  <td className="text-stone-300">
                    {m.ret_fx > 0 ? "▲ " : m.ret_fx < 0 ? "▼ " : ""}{pct(m.ret_fx)}
                  </td>
                  <td className={Math.abs(m.ret_premium) > 0.05 ? "text-amber-400 font-bold" : "text-stone-400"}>
                    {m.ret_premium > 0 ? "▲ " : m.ret_premium < 0 ? "▼ " : ""}{pct(m.ret_premium)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quote History Table */}
      <section className="skeuo-card p-6">
        <div className="rivet rivet-tl" />
        <div className="rivet rivet-tr" />
        <div className="rivet rivet-bl" />
        <div className="rivet rivet-br" />

        <div className="border-b border-stone-800 pb-3 mb-4">
          <h2 className="font-serif text-lg font-bold text-amber-200">
            Latest Stored Quotes &amp; Calculated Premium
          </h2>
          <p className="text-xs text-stone-400">
            Comparing local 8 g price to theoretical equivalent in LKR with reporting lag
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-stone-800 text-left text-xs uppercase text-stone-400">
                <th className="py-2">Quote Date</th>
                <th>Pettah 22K (8g)</th>
                <th>World Equiv (8g)</th>
                <th>Premium Spread</th>
                <th>Lag Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {history.slice(-10).reverse().map((h) => (
                <tr key={h.date} className="hover:bg-stone-800/20">
                  <td className="py-2 text-stone-300">{h.date}</td>
                  <td className="font-bold text-amber-300">{lkr(h.local)}</td>
                  <td className="text-sky-300">{lkr(h.local_equiv)}</td>
                  <td className="text-amber-400">{pct(h.premium)}</td>
                  <td className="text-stone-400 text-xs">{h.lag_days}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
