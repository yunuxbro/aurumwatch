import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "AurumWatch LK | Precious Metals Risk Terminal",
  description: "Daily gold risk brief and inventory exposure engine for Sri Lankan jewellers",
};

export default function RootLayout({ children }) {
  const links = [
    ["/", "Daily Brief"],
    ["/risk", "Stock Risk"],
    ["/changes", "What Changed"],
    ["/health", "Data Health"],
  ];

  return (
    <html lang="en">
      <body className="antialiased selection:bg-amber-500/30 selection:text-amber-200">
        {/* Top Metallic Bevel Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-700 via-amber-300 to-amber-700 shadow-[0_1px_4px_rgba(212,175,55,0.4)]" />

        <header className="border-b border-stone-800/80 bg-[#121620]/90 backdrop-blur-md sticky top-0 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            {/* Hallmark Logo Badge */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/40 bg-gradient-to-br from-amber-200 via-amber-500 to-amber-700 p-0.5 shadow-[0_2px_8px_rgba(212,175,55,0.4)]">
                <div className="flex h-full w-full items-center justify-center rounded-[6px] bg-[#0f131a] text-center font-serif text-sm font-black text-amber-300">
                  Au
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif text-lg font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    AURUMWATCH LK
                  </span>
                  <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-mono tracking-widest text-amber-300">
                    22K / 916
                  </span>
                </div>
                <p className="text-[11px] tracking-wide text-stone-400">
                  Colombo Pettah Precious Metals Risk Monitor
                </p>
              </div>
            </Link>

            {/* Tactile Skeuomorphic Nav Buttons */}
            <nav className="flex items-center gap-2 sm:gap-3">
              {links.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="skeuo-btn px-3 py-1.5 text-xs font-medium tracking-wide text-stone-200 hover:text-amber-300 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>

        <footer className="mx-auto max-w-5xl px-4 pt-4 pb-12">
          <div className="skeuo-card p-4 text-center">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-stone-400">
              <span className="flex items-center gap-1.5 font-mono">
                <span className="led-indicator led-green" />
                SYSTEM STATUS: OPERATIONAL
              </span>
              <span>•</span>
              <span>IEEE CIS Student Chapter, IIT</span>
              <span>•</span>
              <span className="text-amber-400/90 font-medium">Team Noblesse · MODE-LX 2.0</span>
            </div>
            <div className="mt-3 border-t border-stone-800/80 pt-3 text-[11px] leading-relaxed text-stone-500 max-w-2xl mx-auto">
              Risk information and empirical uncertainty intervals only. Not financial advice. This tool never advises to buy or sell.
              Simulated quantiles are model-based estimates constructed via EWMA volatility scaling and historical resampling.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}