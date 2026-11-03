import Papa from "papaparse";
import { todayInSriLanka } from "./date.js";

const KARATS = new Set([18, 22, 24]);
const MAX_ROWS = 1000;

function isValidDate(value, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value <= today;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function validSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateAccountCsv(text, today = todayInSriLanka()) {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
    transform: (value) => value.trim(),
  });
  if (parsed.errors.length) {
    throw new Error(`CSV parsing failed on row ${parsed.errors[0].row + 1}: ${parsed.errors[0].message}`);
  }
  if (!parsed.meta.fields?.length || parsed.data.length === 0) {
    throw new Error("The CSV must include a header row and at least one data row.");
  }
  if (parsed.data.length > MAX_ROWS) {
    throw new Error(`The CSV has more than ${MAX_ROWS} rows. Split it into smaller files.`);
  }

  const headers = new Set(parsed.meta.fields);
  const hasRetailPrice = headers.has("price_lkr_per_8g") || headers.has("lkr_per_8g");
  const hasJewelryDesign = headers.has("name") && headers.has("weight_g");
  if (hasRetailPrice === hasJewelryDesign) {
    throw new Error(
      "Use one supported dataset schema: Pettah prices (date, karat, price_lkr_per_8g, shop_name, source_url) or jewelry designs (name, karat, weight_g).",
    );
  }

  const kind = hasRetailPrice ? "pettah_prices" : "jewelry_designs";
  const accepted = [];
  const rejected = [];

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;
    const karat = Number(row.karat);
    const reasons = [];
    if (!KARATS.has(karat)) reasons.push("karat must be 18, 22, or 24");

    if (kind === "pettah_prices") {
      const price = positiveNumber(row.price_lkr_per_8g || row.lkr_per_8g);
      const shopName = row.shop_name || row.outlet || "";
      if (!isValidDate(row.date || "", today)) reasons.push("date must be a valid non-future YYYY-MM-DD");
      if (price == null) reasons.push("price per 8 g must be a positive number");
      if (!shopName) reasons.push("shop_name is required");
      if (!validSourceUrl(row.source_url || row.url || "")) {
        reasons.push("source_url must be an HTTP or HTTPS URL");
      }
      if (reasons.length === 0) {
        accepted.push({
          date: row.date,
          karat,
          price_lkr_per_8g: price,
          shop_name: shopName.slice(0, 120),
          source_url: row.source_url || row.url,
        });
      }
    } else {
      const weight = positiveNumber(row.weight_g);
      const name = row.name.trim();
      if (!name || name.length > 120) reasons.push("name must contain 1 to 120 characters");
      if (weight == null || weight > 10000) reasons.push("weight_g must be positive and no more than 10000");
      if (reasons.length === 0) {
        accepted.push({
          name,
          karat,
          weight_g: weight,
          material: (row.material || "gold").slice(0, 80),
          notes: (row.notes || "").slice(0, 500),
        });
      }
    }

    if (reasons.length > 0) rejected.push({ row: rowNumber, reasons });
  });

  return {
    kind,
    accepted,
    rejected,
    total_rows: parsed.data.length,
    accepted_rows: accepted.length,
    rejected_rows: rejected.length,
  };
}
