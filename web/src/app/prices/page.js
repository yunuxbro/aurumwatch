import Link from "next/link";
import { getData } from "@/lib/data";
import DealerPriceTable from "@/components/DealerPriceTable";

export const dynamic = "force-dynamic";

export default function Prices() {
  const feed = getData("dealer_quotes") || {};
  const items = Array.isArray(feed.rows) ? feed.rows : [];

  return (
    <div className="page">
      <header className="page-head">
        <p className="page-kicker">Sri Lankan dealer feed</p>
        <h1>Gold prices</h1>
        <p>
          Compare published buying, selling, and listed gold prices in rupees.
          Each price keeps its own rate date and the separate time it was observed.
        </p>
      </header>

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Dealer price board</h2>
            <p className="section-sub">
              Source:{" "}
              <a href="https://lankabizz.net/gold-price-tracker/" target="_blank" rel="noreferrer">
                LankaBIZZ Gold Price Tracker
              </a>
              {feed.last_fetched_at && ` · Last collected ${new Date(feed.last_fetched_at).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}`}
            </p>
          </div>
          <span className={`badge ${items.length ? "badge-info" : "badge-neutral"}`}>
            {items.length ? `${items.length} published prices` : "Feed unavailable"}
          </span>
        </div>

        {items.length ? (
          <DealerPriceTable items={items} />
        ) : (
          <p className="text-muted">
            No dealer prices have been collected yet. The feed refresh runs with the daily market-data task.
          </p>
        )}
      </section>

      <aside className="design-note">
        <span aria-hidden="true">i</span>
        <p>
          These are third-party dealer observations, <strong>not verified Pettah shop quotes</strong>.
          Rates older than seven days are hidden by default; a recent crawl time does not make an older
          rate current. The board keeps both dates visible, and these records are not used as Pettah
          history or in the risk model. See{" "}
          <Link href="/health">Data health</Link> for source and refresh status.
        </p>
      </aside>
    </div>
  );
}
