import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateLiveCandles,
  buildRestChartCandles,
  goldLkrSpotToLkrPer8g,
  goldSpotToLkrPer8g,
} from "../src/lib/live-market.js";
import { GET as getGoldApiQuote } from "../src/app/api/live-market/quote/route.js";

test("converts a gold spot quote to a pure-metal 24K LKR price per 8 grams", () => {
  const price = goldSpotToLkrPer8g(4000, 330);
  assert.equal(price, 4000 / 31.1034768 * 330 * 8);
  assert.equal(goldSpotToLkrPer8g(0, 330), null);
  assert.equal(goldSpotToLkrPer8g(4000, Number.NaN), null);
});

test("converts a GoldAPI XAU/LKR troy-ounce quote to a pure-metal 24K price per 8 grams", () => {
  const price = goldLkrSpotToLkrPer8g(1_000_000);
  assert.equal(price, 1_000_000 / 31.1034768 * 8);
  assert.equal(goldLkrSpotToLkrPer8g(0), null);
  assert.equal(goldLkrSpotToLkrPer8g(Number.NaN), null);
});

test("builds a selectable daily history range and overlays the latest REST quote", () => {
  const rows = [
    {
      date: "2026-01-01",
      open_22k: 100,
      high_22k: 120,
      low_22k: 80,
      close_22k: 110,
      open_24k: 109,
      high_24k: 130,
      low_24k: 90,
      close_24k: 120,
    },
    {
      date: "2026-01-04",
      open_22k: 110,
      high_22k: 125,
      low_22k: 95,
      close_22k: 120,
      open_24k: 120,
      high_24k: 140,
      low_24k: 100,
      close_24k: 130,
    },
  ];
  const quote = {
    timestamp: Date.parse("2026-01-04T12:00:00Z") / 1000,
    price: 1200,
  };
  const candles = buildRestChartCandles(rows, quote, 22, 2);

  assert.equal(candles.length, 1);
  assert.deepEqual(candles[0], {
    timestamp: Date.parse("2026-01-04T00:00:00Z"),
    open: 110,
    high: 1100,
    low: 95,
    close: 1100,
  });
  assert.equal(buildRestChartCandles(rows, quote, 24, 1).length, 1);
  assert.deepEqual(buildRestChartCandles(rows, null, 22, 2).map(({ timestamp }) => timestamp), [
    Date.parse("2026-01-04T00:00:00Z"),
  ]);
});

test("requests and validates a server-side GoldAPI XAU/LKR REST quote", async () => {
  const originalKey = process.env.GOLD_API_KEY;
  const originalInterval = process.env.GOLD_API_POLL_INTERVAL_MS;
  const originalFetch = globalThis.fetch;
  process.env.GOLD_API_KEY = "test-rest-key";
  process.env.GOLD_API_POLL_INTERVAL_MS = "3600000";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://www.goldapi.io/api/price/XAU/LKR?melt_price=false&currency_info=false");
    assert.equal(options.headers["x-access-token"], "test-rest-key");
    return Response.json({
      metal: "XAU",
      currency: "LKR",
      timestamp: 1_800_000_000,
      price: 1_000_000,
      symbol: "XAU/LKR",
    });
  };

  try {
    const request = new Request("http://localhost:3000/api/live-market/quote", {
      headers: {
        origin: "http://localhost:3000",
        host: "localhost:3000",
      },
    });
    const response = await getGoldApiQuote(request);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, "rest");
    assert.equal(body.priceLkrPerTroyOunce, 1_000_000);
    assert.equal(body.pollIntervalMs, 3_600_000);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOLD_API_KEY;
    else process.env.GOLD_API_KEY = originalKey;
    if (originalInterval === undefined) delete process.env.GOLD_API_POLL_INTERVAL_MS;
    else process.env.GOLD_API_POLL_INTERVAL_MS = originalInterval;
  }
});

test("aggregates incoming live prices into time-bucketed OHLC candles", () => {
  const candles = aggregateLiveCandles([
    { timestamp: 120, price: 1200 },
    { timestamp: 61, price: 1000 },
    { timestamp: 80, price: 1100 },
    { timestamp: 121, price: 900 },
    { timestamp: 130, price: 0 },
  ], 60);

  assert.deepEqual(candles, [
    { timestamp: 60_000, open: 1000, high: 1100, low: 1000, close: 1100 },
    { timestamp: 120_000, open: 1200, high: 1200, low: 900, close: 900 },
  ]);
});

test("keeps the newest candle buckets when a chart is bounded", () => {
  const candles = aggregateLiveCandles([
    { timestamp: 60, price: 100 },
    { timestamp: 120, price: 200 },
    { timestamp: 180, price: 300 },
  ], 60, 2);

  assert.deepEqual(candles.map(({ open }) => open), [200, 300]);
});
