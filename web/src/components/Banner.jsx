export default function Banner({ risk }) {
  if (!risk || risk.status === "ok") return null;

  return (
    <div className="relative mb-6 overflow-hidden rounded-xl border border-red-500/40 bg-gradient-to-r from-[#241014] via-[#1a0c10] to-[#241014] p-4 text-sm text-red-200 shadow-[0_4px_20px_rgba(239,68,68,0.25)]">
      <div className="rivet rivet-tl" />
      <div className="rivet rivet-tr" />
      <div className="rivet rivet-bl" />
      <div className="rivet rivet-br" />

      <div className="flex items-start gap-3 pl-3 pr-3">
        <div className="mt-1 flex-shrink-0">
          <span className="led-indicator led-red" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-red-400">
              SAFETY STATE: CANNOT ASSESS (DATA STALE)
            </span>
            <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[10px] text-red-300">
              PDF RULE 5.3 &amp; 7.1 ENFORCED
            </span>
          </div>
          <p className="text-xs text-red-200/90 leading-relaxed">
            {risk.notes?.length ? risk.notes.join(" ") : "Data freshness threshold exceeded. Automatic safeguards enabled."}
          </p>
          <p className="text-[11px] text-amber-300/80">
            💡 <b>Jeweller Action:</b> You can enter today&apos;s shop quote in the interactive simulator below to run an instant risk assessment.
          </p>
        </div>
      </div>
    </div>
  );
}