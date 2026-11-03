import { daysSinceDate } from "./date.js";

export const PETTAH_QUOTE_MAX_AGE_DAYS = 7;
export const MARKET_FEED_MAX_AGE_DAYS = 5;

function isRecentDate(date, today, maxAgeDays) {
  const ageDays = daysSinceDate(date, today);
  return ageDays !== null && ageDays >= 0 && ageDays <= maxAgeDays;
}

function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

export function resolveDashboardPricing({ history, market }, today) {
  const latestQuote = Array.isArray(history) ? history.at(-1) : null;
  const quoteIsCurrent =
    isPositiveFinite(latestQuote?.local) &&
    isRecentDate(latestQuote?.date, today, PETTAH_QUOTE_MAX_AGE_DAYS);

  const marketIsCurrent =
    market?.status === "current" &&
    isPositiveFinite(market.lkr_per_8g_22k) &&
    isRecentDate(market.gold_date, today, MARKET_FEED_MAX_AGE_DAYS) &&
    isRecentDate(market.fx_date, today, MARKET_FEED_MAX_AGE_DAYS);

  const currentPrice = quoteIsCurrent
    ? latestQuote.local
    : marketIsCurrent
      ? market.lkr_per_8g_22k
      : null;
  const worldEquivalentPrice = quoteIsCurrent
    ? (isPositiveFinite(latestQuote.local_equiv) ? latestQuote.local_equiv : null)
    : marketIsCurrent
      ? market.lkr_per_8g_22k
      : null;

  return {
    currentPrice,
    worldEquivalentPrice,
    quoteIsCurrent,
    marketIsCurrent,
    quoteDate: quoteIsCurrent ? latestQuote.date : null,
    latestHistoricalQuoteDate: latestQuote?.date || null,
    goldDate: marketIsCurrent ? market.gold_date : null,
    fxDate: marketIsCurrent ? market.fx_date : null,
    premium: quoteIsCurrent && Number.isFinite(latestQuote.premium)
      ? latestQuote.premium
      : null,
    premiumDifference:
      quoteIsCurrent &&
      isPositiveFinite(latestQuote.local) &&
      isPositiveFinite(latestQuote.local_equiv)
        ? latestQuote.local - latestQuote.local_equiv
        : null,
    priceLabel: quoteIsCurrent
      ? "Pettah 22K sovereign, per 8 g"
      : marketIsCurrent
        ? "22K market estimate, per 8 g"
        : "22K price unavailable",
    priceInputLabel: quoteIsCurrent
      ? "Pettah shop quote"
      : marketIsCurrent
        ? "Daily market estimate"
        : "Enter a current 22K price",
  };
}
