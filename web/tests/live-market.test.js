import assert from "node:assert/strict";
import test from "node:test";
import { aggregateLiveCandles, goldSpotToLkrPer8g } from "../src/lib/live-market.js";

test("converts a gold spot quote to a pure-metal 24K LKR price per 8 grams", () => {
  const price = goldSpotToLkrPer8g(4000, 330);
  assert.equal(price, 4000 / 31.1034768 * 330 * 8);
  assert.equal(goldSpotToLkrPer8g(0, 330), null);
  assert.equal(goldSpotToLkrPer8g(4000, Number.NaN), null);
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
