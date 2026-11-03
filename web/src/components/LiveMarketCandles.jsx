"use client";

import { useMemo, useState } from "react";
import {
  aggregateLiveCandles,
  buildRestChartCandles,
  LIVE_CANDLE_INTERVALS,
  REST_CANDLE_INTERVALS,
} from "@/lib/live-market";

function priceLabel(value) {
  return `Rs ${Math.round(value).toLocaleString("en-LK")}`;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatCandleTime(timestamp, daily) {
  if (!daily) return formatTime(timestamp);
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

export default function LiveMarketCandles({ market, karat, snapshot }) {
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [rangeDays, setRangeDays] = useState(1);
  const intervals = market.mode === "rest" ? REST_CANDLE_INTERVALS : LIVE_CANDLE_INTERVALS;
  const activeRangeDays = intervals.some(({ days }) => days === rangeDays)
    ? rangeDays
    : intervals[0].days;
  const dailyRestChart = market.mode === "rest";
  const factor = karat / 24;
  const candles = useMemo(
    () => market.mode === "rest"
      ? buildRestChartCandles(snapshot?.rows, market.latest, karat, activeRangeDays)
      : aggregateLiveCandles(market.ticks, intervalSeconds, 120).map((candle) => ({
        ...candle,
        open: candle.open * factor,
        high: candle.high * factor,
        low: candle.low * factor,
        close: candle.close * factor,
      })),
    [activeRangeDays, factor, intervalSeconds, karat, market.latest, market.mode, market.ticks, snapshot?.rows],
  );
  const latestPrice = market.latest?.price * factor;

  if (candles.length === 0) {
    return (
      <div className="live-market-empty" role={market.error ? "alert" : "status"}>
        <strong>
          {market.status === "unconfigured"
            ? "Connect a live price feed"
            : market.mode === "rest" ? "Waiting for the first REST quote" : "Waiting for live market ticks"}
        </strong>
        <p>{market.error || "Live price candles will appear as soon as the provider sends gold and USD/LKR updates."}</p>
        <p>Live estimate is pure gold converted to LKR per 8 g; it excludes local dealer premiums, workmanship, and taxes.</p>
      </div>
    );
  }

  const allPrices = candles.flatMap((candle) => [candle.low, candle.high]);
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const room = Math.max((max - min) * 0.1, max * 0.001);
  const low = min - room;
  const high = max + room;
  const width = 1000;
  const height = 330;
  const left = 82;
  const right = 18;
  const top = 18;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const step = plotWidth / candles.length;
  const candleWidth = Math.max(3, Math.min(12, step * 0.62));
  const x = (index) => left + (index + 0.5) * step;
  const y = (value) => top + (1 - (value - low) / (high - low)) * plotHeight;
  const last = candles.at(-1);
  const singleRestQuote = market.mode === "rest" && candles.length === 1;
  const chartTime = (timestamp) => formatCandleTime(timestamp, dailyRestChart);

  return (
    <div className="live-market-chart">
      <div className="live-market-toolbar">
        <div>
          <strong>
            {karat}K {market.mode === "rest"
              ? dailyRestChart
                ? market.latest ? "daily benchmark + latest quote" : "daily benchmark history"
                : "periodic quote candles"
              : "live candles"} · LKR per 8 g
          </strong>
          <span>
            {latestPrice
              ? `Latest indicative close ${priceLabel(latestPrice)}`
              : market.mode === "rest" ? "Loading latest periodic quote" : "Connected; collecting the first ticks"}
            {market.latest?.timestamp ? ` · updated ${formatTime(market.latest.timestamp * 1000)} SL time` : ""}
          </span>
          <span>
            {market.mode === "rest"
              ? `GoldAPI REST quote · polling every ${Math.round((market.pollIntervalMs || 10_800_000) / 60_000)} minutes · excludes local premiums and charges`
              : `Gold spot × USD/LKR × ${karat}/24 purity · excludes local premiums and charges`}
          </span>
        </div>
        <div className="live-market-intervals" role="group" aria-label={market.mode === "rest" ? "Market chart date range" : "Live candle interval"}>
          {intervals.map((interval) => (
            <button
              key={interval.label}
              type="button"
              aria-pressed={market.mode === "rest"
                ? activeRangeDays === interval.days
                : intervalSeconds === interval.seconds}
              onClick={() => market.mode === "rest"
                ? setRangeDays(interval.days)
                : setIntervalSeconds(interval.seconds)}
            >
              {interval.label}
            </button>
          ))}
        </div>
      </div>
      <div className="market-candle-chart-wrap">
        <svg
          className="market-candle-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Live ${karat} karat gold candles in Sri Lankan rupees per 8 grams`}
        >
          {[0, 1, 2, 3].map((index) => {
            const value = high - ((high - low) * index) / 3;
            const lineY = y(value);
            return (
              <g key={index}>
                <line x1={left} x2={width - right} y1={lineY} y2={lineY} className="candle-grid" />
                <text x={left - 10} y={lineY + 4} textAnchor="end" className="candle-axis-label">
                  Rs {(value / 1000).toFixed(1)}k
                </text>
              </g>
            );
          })}
          {singleRestQuote && (
            <g className="rest-quote-level">
              <line x1={left} x2={width - right} y1={y(last.close)} y2={y(last.close)} />
              <circle cx={width - right} cy={y(last.close)} r="5" />
            </g>
          )}
          {candles.map((candle, index) => {
            if (singleRestQuote) return null;
            const rising = candle.close >= candle.open;
            const candleX = x(index);
            const bodyTop = y(Math.max(candle.open, candle.close));
            const bodyBottom = y(Math.min(candle.open, candle.close));
            return (
              <g key={candle.timestamp} className={`candle${rising ? " rising" : " falling"}`}>
                <title>
                  {`${chartTime(candle.timestamp)} · O ${priceLabel(candle.open)} · H ${priceLabel(candle.high)} · L ${priceLabel(candle.low)} · C ${priceLabel(candle.close)}`}
                </title>
                <line x1={candleX} x2={candleX} y1={y(candle.high)} y2={y(candle.low)} className="candle-wick" />
                <rect
                  x={candleX - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={Math.max(1.5, bodyBottom - bodyTop)}
                  className="candle-body"
                  rx="1"
                />
              </g>
            );
          })}
          {singleRestQuote ? (
            <text x={width - right} y={height - 8} textAnchor="end" className="candle-axis-label">
              Latest quote · {chartTime(last.timestamp)}
            </text>
          ) : (
            <>
              <text x={left} y={height - 8} className="candle-axis-label">{chartTime(candles[0].timestamp)}</text>
              <text x={width - right} y={height - 8} textAnchor="end" className="candle-axis-label">
                {chartTime(last.timestamp)}
              </text>
            </>
          )}
        </svg>
      </div>
      {singleRestQuote && (
        <p className="market-candle-basis">
          One chart interval is available so far. The dashed line marks its close; a trend will appear as additional interval candles arrive.
        </p>
      )}
      <div className="market-candle-detail" aria-live="polite">
        <strong>{chartTime(last.timestamp)}</strong>
        <span>O {priceLabel(last.open)}</span>
        <span>H {priceLabel(last.high)}</span>
        <span>L {priceLabel(last.low)}</span>
        <span>C {priceLabel(latestPrice || last.close)}</span>
      </div>
      <p className="market-candle-basis">
        {market.mode === "rest"
          ? dailyRestChart
            ? market.latest
              ? "Historical daily candles use the app's dated gold/FX benchmark; the newest date is updated with the latest GoldAPI REST quote. REST polling is periodic, not tick-by-tick, and historical candles are not GoldAPI history."
              : "Historical daily candles use the app's dated gold/FX benchmark. The latest GoldAPI REST quote is loading; REST polling is periodic, not tick-by-tick, and historical candles are not GoldAPI history."
            : "This REST quote refreshes periodically, not tick-by-tick. Provider plan limits constrain update frequency. The benchmark is not a quoted shop price or guaranteed trade."
          : "A live spot-derived estimate, not a quoted shop price or guaranteed trade. Candles only move when the price provider sends a new market update."}
      </p>
    </div>
  );
}
