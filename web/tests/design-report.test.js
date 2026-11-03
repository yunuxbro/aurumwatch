import test from "node:test";
import assert from "node:assert/strict";
import { createDesignReport } from "../src/lib/design-report.js";

test("creates a downloadable report with pricing and order details", () => {
  const report = createDesignReport({
    previewImage: null,
    designName: "Gemstone ring",
    cadFileName: "",
    quantity: 2,
    karat: 22,
    goldWeightPerPiece: 4.75,
    goldWeightForOrder: 9.5,
    fineGoldForOrder: 8.708,
    alloyDensity: 17.65,
    marketReference: {
      gold_usd_per_oz: 3970,
      gold_date: "2026-11-02",
      gold_source: "test gold feed",
      usd_lkr: 332,
      fx_date: "2026-11-02",
      fx_source: "test FX feed",
      lkr_per_gram_24k: 42390,
      lkr_per_8g_22k: 310860,
      lkr_per_8g_18k: 254340,
    },
    marketMetalPerPiece: 180000,
    makingCharge: 5000,
    stoneCost: 3500,
    totalPerPiece: 188500,
    budget: 500000,
    affordablePieces: 2,
    localEstimatePerPiece: null,
    localQuoteIsCurrent: false,
    localQuoteDate: "2026-11-02",
    localQuotePrice: 0,
    marketHistory: [
      { date: "2026-11-01", local_equiv: 309000 },
      { date: "2026-11-02", local_equiv: 310860 },
    ],
    generatedDate: "2026-11-03",
  });

  const bytes = new Uint8Array(report.output("arraybuffer"));
  const pdfText = new TextDecoder().decode(bytes);
  assert.ok(bytes.length > 2000);
  assert.ok(pdfText.startsWith("%PDF-"));
  assert.match(pdfText, /AurumWatch LK/);
});
