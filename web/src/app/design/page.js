import { getData } from "@/lib/data";
import DesignStudio from "@/components/DesignStudio";
import { daysSinceDate, todayInSriLanka } from "@/lib/date";

export const dynamic = "force-dynamic";

export default function DesignPage() {
  const history = getData("history") || [];
  const storedMarketReference = getData("market_reference");
  const today = todayInSriLanka();
  const goldAgeDays = daysSinceDate(storedMarketReference?.gold_date, today);
  const fxAgeDays = daysSinceDate(storedMarketReference?.fx_date, today);
  const marketReference = storedMarketReference
    ? {
      ...storedMarketReference,
      gold_age_days: goldAgeDays,
      fx_age_days: fxAgeDays,
      status: (
        goldAgeDays != null &&
        fxAgeDays != null &&
        goldAgeDays >= 0 &&
        fxAgeDays >= 0 &&
        Math.max(goldAgeDays, fxAgeDays) <= 5 &&
        storedMarketReference.gold_usd_per_oz > 0 &&
        storedMarketReference.usd_lkr > 0
      ) ? "current" : "stale",
    }
    : null;

  return (
    <div className="page">
      <header className="page-head">
        <p className="page-kicker">For goldsmiths &amp; buyers</p>
        <h1>Jewellery design studio</h1>
        <p>Upload a CAD model, estimate its gold allocation, and plan a budget using current market data or a verified shop quote.</p>
      </header>
      <DesignStudio
        marketReference={marketReference}
        marketHistory={history}
        today={today}
      />
    </div>
  );
}
