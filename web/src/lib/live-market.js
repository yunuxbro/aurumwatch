const TROY_OUNCE_GRAMS = 31.1034768;

export const LIVE_CANDLE_INTERVALS = [
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "15m", seconds: 900 },
  { label: "1h", seconds: 3600 },
  { label: "4h", seconds: 14400 },
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
