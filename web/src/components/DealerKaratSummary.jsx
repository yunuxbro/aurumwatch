import { daysSinceDate, todayInSriLanka } from "@/lib/date";
import { lkr } from "@/lib/format";

const KARATS = [24, 22, 18];

function per8g(item) {
  const price = Number(item.price_lkr);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (item.unit === "pawn_8g") return price;
  if (item.unit === "gram") return price * 8;
  return null;
}

export default function DealerKaratSummary({ items = [] }) {
  const today = todayInSriLanka();
  const grouped = new Map();
  items.forEach((item) => {
    if (!["selling", "listed"].includes(item.side) || !KARATS.includes(Number(item.karat))) return;
    const age = daysSinceDate(item.rate_date, today);
    const price = per8g(item);
    if (age == null || age < 0 || age > 7 || price == null) return;
    const shop = item.institution;
    if (!grouped.has(shop)) grouped.set(shop, { shop, prices: new Map() });
    const values = grouped.get(shop).prices.get(Number(item.karat)) || [];
    values.push({ price, side: item.side, date: item.rate_date });
    grouped.get(shop).prices.set(Number(item.karat), values);
  });
  const shops = [...grouped.values()].sort((a, b) => a.shop.localeCompare(b.shop));

  return (
    <section className="card panel">
      <div className="section-header">
        <div>
          <h2 className="section-title">Current dealer prices by purity</h2>
          <p className="section-sub">
            Published selling/listed prices normalized to LKR per 8 g. Blank means that shop has no recent listed rate for that karat.
          </p>
        </div>
      </div>
      <div className="scroll-x">
        <table className="data-table">
          <thead>
            <tr><th scope="col">Seller</th>{KARATS.map((karat) => <th scope="col" key={karat}>{karat}K · LKR / 8 g</th>)}</tr>
          </thead>
          <tbody>
            {shops.map(({ shop, prices }) => (
              <tr key={shop}>
                <th scope="row">{shop}</th>
                {KARATS.map((karat) => (
                  <td key={karat}>
                    {(prices.get(karat) || []).map((quote, index) => (
                      <span className="dealer-karat-price" key={`${quote.side}-${quote.date}-${index}`}>
                        <strong>{lkr(quote.price)}</strong>
                        <small>{quote.side} · {quote.date}</small>
                      </span>
                    ))}
                    {!prices.has(karat) && <span className="text-muted">Not listed</span>}
                  </td>
                ))}
              </tr>
            ))}
            {shops.length === 0 && <tr><td colSpan={4}>No recent 24K, 22K, or 18K seller prices are available.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="section-sub" style={{ marginTop: ".75rem" }}>
        Only seller-published karat prices are shown; missing rates are not estimated from another purity.
      </p>
    </section>
  );
}
