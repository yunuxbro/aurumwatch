import test from "node:test";
import assert from "node:assert/strict";
import { validateAccountCsv } from "../src/lib/account-data.js";

test("validates and cleans private Pettah quote rows", () => {
  const result = validateAccountCsv(
    "date,karat,price_lkr_per_8g,shop_name,source_url\n2026-11-02,22,400000,Sea Street Jeweller,https://example.com/quote\n2026-11-04,22,-10,Unknown,not-a-url",
    "2026-11-03",
  );

  assert.equal(result.kind, "pettah_prices");
  assert.equal(result.accepted_rows, 1);
  assert.equal(result.rejected_rows, 1);
  assert.deepEqual(result.accepted[0], {
    date: "2026-11-02",
    karat: 22,
    price_lkr_per_8g: 400000,
    shop_name: "Sea Street Jeweller",
    source_url: "https://example.com/quote",
  });
  assert.ok(result.rejected[0].reasons.some((reason) => reason.includes("non-future")));
});

test("validates jewelry rows and drops invalid data from cleaned output", () => {
  const result = validateAccountCsv(
    "name,karat,weight_g,material,notes\nGold ring,22,4.5,rose gold,Sample\nInvalid chain,20,0,,",
    "2026-11-03",
  );

  assert.equal(result.kind, "jewelry_designs");
  assert.equal(result.accepted_rows, 1);
  assert.equal(result.rejected_rows, 1);
  assert.equal(result.accepted[0].weight_g, 4.5);
  assert.equal(result.accepted[0].material, "rose gold");
});

test("rejects CSVs that mix unrelated dataset schemas", () => {
  assert.throws(
    () => validateAccountCsv(
      "date,karat,price_lkr_per_8g,name,weight_g\n2026-11-02,22,400000,Gold ring,4.5",
      "2026-11-03",
    ),
    /one supported dataset schema/,
  );
});
