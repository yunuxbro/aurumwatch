import assert from "node:assert/strict";
import test from "node:test";
import { ADDITIONAL_GOLD_SHOPS, getCurrentDealerQuotes } from "../src/lib/dealer-pricing.js";

const today = "2026-11-03";

test("provides five additional jewellers without inventing their prices", () => {
  assert.equal(ADDITIONAL_GOLD_SHOPS.length, 5);
  assert.ok(ADDITIONAL_GOLD_SHOPS.every((shop) => shop.institution && !("price_lkr_per_8g" in shop)));
  assert.deepEqual(
    ADDITIONAL_GOLD_SHOPS.map((shop) => shop.institution),
    [
      "Vogue Jewellers",
      "Swarnamahal Jewellers",
      "Mallika Hemachandra Jewellers",
      "Raja Jewellers",
      "Imeeshi Jewellery",
    ],
  );
});

test("normalizes fresh 22K published seller quotes to LKR per 8 g", () => {
  const quotes = getCurrentDealerQuotes([
    {
      institution: "CMB Gold",
      karat: 22,
      side: "selling",
      unit: "gram",
      price_lkr: 40673,
      rate_date: "2026-11-02",
      source_url: "https://example.com/cmb",
    },
    {
      institution: "Devi Jewellers",
      karat: 22,
      side: "listed",
      unit: "pawn_8g",
      price_lkr: 326600,
      rate_date: "2026-11-02",
      source_url: "https://example.com/devi",
    },
  ], today);

  assert.deepEqual(quotes.map(({ institution }) => institution), ["CMB Gold", "Devi Jewellers"]);
  assert.equal(quotes[0].price_lkr_per_8g, 325384);
  assert.equal(quotes[1].price_lkr_per_8g, 326600);
  assert.equal(quotes[0].source, "Published Sri Lankan dealer feed");
});

test("uses latest dated records and median when a shop has duplicate unit sources", () => {
  const quotes = getCurrentDealerQuotes([
    { institution: "CMB Gold", karat: 22, side: "selling", unit: "gram", price_lkr: 40000, rate_date: "2026-11-01", source_url: "https://example.com/old" },
    { institution: "CMB Gold", karat: 22, side: "selling", unit: "gram", price_lkr: 40000, rate_date: "2026-11-02", source_url: "https://example.com/a" },
    { institution: "CMB Gold", karat: 22, side: "selling", unit: "pawn_8g", price_lkr: 328000, rate_date: "2026-11-02", source_url: "https://example.com/b" },
  ], today);

  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].price_lkr_per_8g, 324000);
  assert.deepEqual(quotes[0].source_urls, ["https://example.com/a", "https://example.com/b"]);
});

test("excludes stale, future, unsupported, invalid, and non-22K quotes", () => {
  const quotes = getCurrentDealerQuotes([
    { institution: "Stale", karat: 22, side: "selling", unit: "pawn_8g", price_lkr: 320000, rate_date: "2026-10-25" },
    { institution: "Future", karat: 22, side: "listed", unit: "pawn_8g", price_lkr: 320000, rate_date: "2026-11-04" },
    { institution: "Other karat", karat: 18, side: "listed", unit: "pawn_8g", price_lkr: 320000, rate_date: "2026-11-02" },
    { institution: "Unsupported unit", karat: 22, side: "listed", unit: "ounce", price_lkr: 320000, rate_date: "2026-11-02" },
    { institution: "Invalid price", karat: 22, side: "listed", unit: "pawn_8g", price_lkr: 0, rate_date: "2026-11-02" },
    { institution: "Buying only", karat: 22, side: "buying", unit: "pawn_8g", price_lkr: 320000, rate_date: "2026-11-02" },
  ], today);

  assert.deepEqual(quotes, []);
});
