import { DEALER_QUOTE_MAX_AGE_DAYS } from "./dashboard-pricing.js";
import { daysSinceDate } from "./date.js";

const ACCEPTED_SIDES = ["selling", "listed"];

export const ADDITIONAL_GOLD_SHOPS = [
  { institution: "Vogue Jewellers", source_url: "https://www.voguejewellers.com/" },
  { institution: "Swarnamahal Jewellers", source_url: "https://www.swarnamahal.lk/" },
  { institution: "Mallika Hemachandra Jewellers", source_url: "https://mallikahemachandra.com/" },
  { institution: "Raja Jewellers", source_url: "https://www.rajajewellers.com/" },
  { institution: "Imeeshi Jewellery", location: "Sea Street, Colombo", source_url: null },
];

function pricePer8g(row) {
  const price = Number(row.price_lkr);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (row.unit === "pawn_8g") return price;
  if (row.unit === "gram") return price * 8;
  return null;
}

export function getCurrentDealerQuotes(rows, today) {
  if (!Array.isArray(rows)) return [];

  const grouped = new Map();
  for (const row of rows) {
    const institution = typeof row.institution === "string" ? row.institution.trim() : "";
    const side = typeof row.side === "string" ? row.side.toLowerCase() : "";
    const age = daysSinceDate(row.rate_date, today);
    const price = Number(row.karat) === 22 ? pricePer8g(row) : null;
    if (
      !institution ||
      !ACCEPTED_SIDES.includes(side) ||
      age == null ||
      age < 0 ||
      age > DEALER_QUOTE_MAX_AGE_DAYS ||
      price == null
    ) continue;

    const key = `${institution.toLowerCase()}|${side}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ ...row, institution, side, price_per_8g: price });
  }

  const quotes = [];
  for (const candidates of grouped.values()) {
    const latestDate = candidates.reduce(
      (latest, row) => row.rate_date > latest ? row.rate_date : latest,
      "",
    );
    const latestRows = candidates.filter((row) => row.rate_date === latestDate);
    const values = latestRows.map((row) => row.price_per_8g).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    const median = values.length % 2
      ? values[middle]
      : (values[middle - 1] + values[middle]) / 2;
    const sourceUrls = [...new Set(latestRows.map((row) => row.source_url).filter(Boolean))];
    const representative = latestRows[0];
    quotes.push({
      id: `${representative.institution.toLowerCase()}|${representative.side}`,
      institution: representative.institution,
      institution_type: representative.institution_type,
      side: representative.side,
      price_lkr_per_8g: median,
      rate_date: latestDate,
      source: "Published Sri Lankan dealer feed",
      source_url: sourceUrls[0] || null,
      source_urls: sourceUrls,
    });
  }

  return quotes.sort((a, b) => a.institution.localeCompare(b.institution));
}
