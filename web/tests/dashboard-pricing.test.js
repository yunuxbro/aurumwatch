import assert from "node:assert/strict";
import test from "node:test";
import { resolveDashboardPricing } from "../src/lib/dashboard-pricing.js";

const market = {
  status: "current",
  gold_date: "2026-11-02",
  fx_date: "2026-11-02",
  lkr_per_8g_22k: 310926.8,
};

test("uses a current market benchmark instead of a stale Pettah quote", () => {
  const pricing = resolveDashboardPricing({
    history: [{ date: "2026-05-06", local: 363400, local_equiv: 350777, premium: 0.035 }],
    market,
  }, "2026-11-03");

  assert.equal(pricing.currentPrice, 310926.8);
  assert.equal(pricing.worldEquivalentPrice, 310926.8);
  assert.equal(pricing.quoteIsCurrent, false);
  assert.equal(pricing.marketIsCurrent, true);
  assert.equal(pricing.premium, null);
  assert.equal(pricing.premiumDifference, null);
});

test("prefers a recent Pettah quote and its contemporaneous comparison", () => {
  const pricing = resolveDashboardPricing({
    history: [{ date: "2026-11-01", local: 320000, local_equiv: 310000, premium: 0.032 }],
    market,
  }, "2026-11-03");

  assert.equal(pricing.currentPrice, 320000);
  assert.equal(pricing.worldEquivalentPrice, 310000);
  assert.equal(pricing.quoteIsCurrent, true);
  assert.equal(pricing.premium, 0.032);
});

test("does not substitute stale or future market data", () => {
  const staleMarket = { ...market, gold_date: "2026-10-01" };
  const futureQuote = { date: "2026-11-04", local: 320000, local_equiv: 310000, premium: 0.032 };
  const pricing = resolveDashboardPricing({
    history: [futureQuote],
    market: staleMarket,
  }, "2026-11-03");

  assert.equal(pricing.currentPrice, null);
  assert.equal(pricing.quoteIsCurrent, false);
  assert.equal(pricing.marketIsCurrent, false);
});

test("prefers a fresh Sri Lankan dealer guide when there is no Pettah quote", () => {
  const pricing = resolveDashboardPricing({
    history: [],
    market: {
      ...market,
      dealer_reference: {
        status: "current",
        rate_date: "2026-11-02",
        price_lkr_per_8g: 326600,
        quote_count: 2,
      },
    },
  }, "2026-11-03");

  assert.equal(pricing.currentPrice, 326600);
  assert.equal(pricing.worldEquivalentPrice, market.lkr_per_8g_22k);
  assert.equal(pricing.quoteIsCurrent, false);
  assert.equal(pricing.dealerReferenceIsCurrent, true);
  assert.equal(pricing.dealerReferenceDate, "2026-11-02");
  assert.equal(pricing.priceLabel, "Sri Lankan dealer guide, 22K per 8 g");
});

test("rejects stale and future Sri Lankan dealer references", () => {
  for (const rateDate of ["2026-10-25", "2026-11-04"]) {
    const pricing = resolveDashboardPricing({
      history: [],
      market: {
        ...market,
        dealer_reference: {
          status: "current",
          rate_date: rateDate,
          price_lkr_per_8g: 326600,
          quote_count: 2,
        },
      },
    }, "2026-11-03");

    assert.equal(pricing.dealerReferenceIsCurrent, false);
    assert.equal(pricing.currentPrice, market.lkr_per_8g_22k);
  }
});
