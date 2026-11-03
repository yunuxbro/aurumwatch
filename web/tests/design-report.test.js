import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { createDesignReport } from "../src/lib/design-report.js";

function pngChunk(type, payload) {
  const typeBytes = Buffer.from(type);
  const chunkData = Buffer.concat([typeBytes, payload]);
  let crc = 0xffffffff;
  for (const byte of chunkData) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, chunkData, checksum]);
}

function onePixelPng() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.from([0, 255, 255, 255, 255]))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

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
    marketCandles: {
      rows: [
        { date: "2026-11-01", close: 309000, close_24k: 337090 },
        { date: "2026-11-02", close: 310860, close_24k: 339120 },
      ],
    },
    generatedDate: "2026-11-03",
  });

  const bytes = new Uint8Array(report.output("arraybuffer"));
  const pdfText = new TextDecoder().decode(bytes);
  assert.ok(bytes.length > 2000);
  assert.ok(pdfText.startsWith("%PDF-"));
  assert.match(pdfText, /AurumWatch LK/);
});

test("embeds the captured jewelry preview in the PDF", () => {
  const report = createDesignReport({
    previewImage: `data:image/png;base64,${onePixelPng()}`,
    designName: "Uploaded ring",
    cadFileName: "ring.stl",
    quantity: 1,
    karat: 24,
    goldWeightPerPiece: 4,
    goldWeightForOrder: 4,
    fineGoldForOrder: 3.667,
    alloyDensity: 17.65,
    marketReference: {},
    dealerReference: {
      status: "current",
      price_lkr_per_8g: 326600,
      rate_date: "2026-11-02",
      quote_count: 3,
    },
    selectedDealerQuote: {
      institution: "CMB Gold",
      side: "selling",
      price_lkr_per_8g: 325384,
      rate_date: "2026-11-02",
    },
    dealerShopQuotes: [
      {
        institution: "CMB Gold",
        side: "selling",
        price_lkr_per_8g: 325384,
        rate_date: "2026-11-02",
        source_url: "https://www.cmbgold.lk/srilanka-gold-price-today",
      },
      {
        institution: "Devi Jewellers",
        side: "listed",
        price_lkr_per_8g: 326600,
        rate_date: "2026-11-02",
        source_url: "https://devijewellers.lk/gold-rate",
      },
    ],
    shopDirectory: [
      { institution: "Vogue Jewellers", source_url: "https://www.voguejewellers.com/" },
      { institution: "Imeeshi Jewellery", location: "Sea Street, Colombo", source_url: null },
    ],
    marketCandles: {
      rows: [
        { date: "2026-11-01", close: 309000, close_24k: 337090 },
        { date: "2026-11-02", close: 310860, close_24k: 339120 },
      ],
    },
    marketMetalPerPiece: 170000,
    makingCharge: 5000,
    stoneCost: 0,
    totalPerPiece: 175000,
    budget: 300000,
    affordablePieces: 1,
    localEstimatePerPiece: null,
    localQuoteIsCurrent: true,
    localQuoteDate: "2026-11-02",
    localQuotePrice: 326000,
    localQuoteShopName: "Imeeshi Jewellery",
    localEstimatePerPiece: 175000,
    generatedDate: "2026-11-03",
  });

  const pdfText = new TextDecoder().decode(new Uint8Array(report.output("arraybuffer")));
  assert.match(pdfText, /\/Subtype \/Image/);
  assert.match(pdfText, /Selected published shop basis: CMB Gold/);
  assert.match(pdfText, /Published rates and Sri Lankan jeweller directory/);
  assert.match(pdfText, /comparison for Imeeshi Jewellery/);
  assert.match(pdfText, /Recent 24K benchmark history/);
  assert.match(pdfText, /CMB Gold/);
  assert.match(pdfText, /Devi Jewellers/);
  assert.match(pdfText, /Imeeshi Jewellery/);
  assert.match(pdfText, /cmbgold\.lk/);
});
