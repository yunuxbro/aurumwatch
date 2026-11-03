const TROY_OUNCE_GRAMS = 31.1034768;

export const LIVE_CANDLE_INTERVALS = [
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "15m", seconds: 900 },
  { label: "1h", seconds: 3600 },
  { label: "4h", seconds: 14400 },
];

export const REST_CANDLE_INTERVALS = [
  { label: "1D", days: 1 },
  { label: "1W", days: 7 },
  { label: "1M", days: 31 },
  { label: "3M", days: 92 },
  { label: "6M", days: 183 },
  { label: "1Y", days: 366 },
];

export function goldSpotToLkrPer8g(goldUsdPerTroyOunce, usdLkr) {
  if (
    !Number.isFinite(goldUsdPerTroyOunce) ||
    goldUsdPerTroyOunce <= 0 ||
    !Number.isFinite(usdLkr) ||
    usdLkr <= 0
  ) return null;

  return goldUsdPerTroyOunce / TROY_OUNCE_GRAMS * usdLkr * 8;
}

export function goldLkrSpotToLkrPer8g(goldLkrPerTroyOunce) {
  if (!Number.isFinite(goldLkrPerTroyOunce) || goldLkrPerTroyOunce <= 0) return null;
  return goldLkrPerTroyOunce / TROY_OUNCE_GRAMS * 8;
}

export function buildRestChartCandles(rows, latestQuote, karat, rangeDays) {
  if (!Array.isArray(rows) || ![22, 24].includes(karat) || !Number.isInteger(rangeDays) || rangeDays <= 0) {
    return [];
  }

  const candles = rows.flatMap((row) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date || "")) return [];
    const timestamp = Date.parse(`${row.date}T00:00:00Z`);
    const value = (field) => {
      const byKarat = Number(row[`${field}_${karat}k`]);
      if (Number.isFinite(byKarat) && byKarat > 0) return byKarat;
      const base = Number(row[field]);
      return Number.isFinite(base) && base > 0
        ? karat === 24 ? base * 24 / 22 : base
        : null;
    };
    const open = value("open");
    const high = value("high");
    const low = value("low");
    const close = value("close");
    if (!Number.isFinite(timestamp) || [open, high, low, close].some((price) => price == null)) return [];
    return [{ timestamp, open, high, low, close }];
  });

  const quoteTimestamp = Number(latestQuote?.timestamp) * 1000;
  const quotePrice = Number(latestQuote?.price) * karat / 24;
  if (Number.isFinite(quoteTimestamp) && Number.isFinite(quotePrice) && quotePrice > 0) {
    const dayTimestamp = Math.floor(quoteTimestamp / 86_400_000) * 86_400_000;
    const sameDay = candles.find((candle) => candle.timestamp === dayTimestamp);
    if (sameDay) {
      sameDay.high = Math.max(sameDay.high, quotePrice);
      sameDay.low = Math.min(sameDay.low, quotePrice);
      sameDay.close = quotePrice;
    } else {
      candles.push({
        timestamp: dayTimestamp,
        open: quotePrice,
        high: quotePrice,
        low: quotePrice,
        close: quotePrice,
      });
    }
  }

  candles.sort((left, right) => left.timestamp - right.timestamp);
  const latestTimestamp = candles.at(-1)?.timestamp;
  if (!Number.isFinite(latestTimestamp)) return [];
  const firstTimestamp = latestTimestamp - (rangeDays - 1) * 86_400_000;
  return candles.filter((candle) => candle.timestamp >= firstTimestamp);
}

export function aggregateLiveCandles(points, intervalSeconds, limit = 120) {
  if (!Array.isArray(points) || !Number.isInteger(intervalSeconds) || intervalSeconds <= 0) {
    return [];
  }

  const candles = new Map();
  for (const point of points) {
    const timestamp = Number(point.timestamp);
    const price = Number(point.price);
    if (!Number.isFinite(timestamp) || !Number.isFinite(price) || price <= 0) continue;

    const bucket = Math.floor(timestamp / intervalSeconds) * intervalSeconds;
    const candle = candles.get(bucket);
    if (candle) {
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      candle.close = price;
    } else {
      candles.set(bucket, {
        timestamp: bucket * 1000,
        open: price,
        high: price,
        low: price,
        close: price,
      });
    }
  }

  return [...candles.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, candle]) => candle)
    .slice(-limit);
}
