import Link from "next/link";
import { getData } from "@/lib/data";
import DealerPriceTable from "@/components/DealerPriceTable";
import { ADDITIONAL_GOLD_SHOPS } from "@/lib/dealer-pricing";

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
              Source: public Sri Lankan dealer feed
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

      <section className="card panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">More Sri Lankan gold shops</h2>
            <p className="section-sub">
              These five jewellers are available for quote comparison. A shop is not shown with a price unless a dated rate can be verified.
            </p>
          </div>
        </div>
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr><th scope="col">Jeweller</th><th scope="col">Location</th><th scope="col">Available rate</th><th scope="col">Shop</th></tr>
            </thead>
            <tbody>
              {ADDITIONAL_GOLD_SHOPS.map((shop) => (
                <tr key={shop.institution}>
                  <td>{shop.institution}</td>
                  <td>{shop.location || "Sri Lanka"}</td>
                  <td>Enter a dated, verified quote</td>
                  <td>
                    {shop.source_url
                      ? <a href={shop.source_url} target="_blank" rel="noreferrer">Visit website</a>
                      : "Referenced shop"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
