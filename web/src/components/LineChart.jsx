export default function LineChart({ data = [], lines = [], height = 260 }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-stone-500 p-4 text-center">No chart data available.</p>;
  }
  const W = 640, H = height, P = 45;
  const vals = data.flatMap((d) => lines.map((l) => d[l.key])).filter((v) => v != null);
  if (vals.length === 0) {
    return <p className="text-sm text-stone-500 p-4 text-center">No chart values to display.</p>;
  }
  const min = Math.min(...vals), max = Math.max(...vals);
  const x = (i) => P + (i * (W - 2 * P)) / Math.max(data.length - 1, 1);
  const y = (v) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);

  // Subtle grid levels
  const yMid = H / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full font-mono">
      {/* Background Subtle Grid Lines */}
      <line x1={P} y1={y(max)} x2={W - P} y2={y(max)} stroke="#263143" strokeDasharray="3 3" />
      <line x1={P} y1={yMid} x2={W - P} y2={yMid} stroke="#1e2736" strokeDasharray="3 3" />
      <line x1={P} y1={y(min)} x2={W - P} y2={y(min)} stroke="#263143" strokeDasharray="3 3" />

      {/* Series Polylines with Glow */}
      {lines.map((l) => (
        <g key={l.key}>
          <polyline
            fill="none"
            stroke={l.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={data.map((d, i) => `${x(i)},${y(d[l.key])}`).join(" ")}
          />
        </g>
      ))}

      {/* Legend at Top */}
      {lines.map((l, i) => (
        <text key={l.key} x={P + i * 200} y={16} fontSize="11" fill={l.color} fontWeight="bold">
          ● {l.label}
        </text>
      ))}

      {/* Axis Labels & Dates */}
      <text x={P} y={H - 12} fontSize="10" fill="#94a3b8">
        {data[0]?.date}
      </text>
      <text x={W - P} y={H - 12} fontSize="10" fill="#94a3b8" textAnchor="end">
        {data.at(-1)?.date}
      </text>
      <text x={4} y={y(max) + 4} fontSize="10" fill="#cbd5e1">
        Rs {Math.round(max / 1000)}k
      </text>
      <text x={4} y={y(min) + 4} fontSize="10" fill="#94a3b8">
        Rs {Math.round(min / 1000)}k
      </text>
    </svg>
  );
}