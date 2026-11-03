"use client";

import { useMemo, useState } from "react";
import { aggregateLiveCandles, LIVE_CANDLE_INTERVALS } from "@/lib/live-market";

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

export default function LiveMarketCandles({ market, karat }) {
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const factor = karat / 24;
  const candles = useMemo(
    () => aggregateLiveCandles(market.ticks, intervalSeconds, 120).map((candle) => ({
      ...candle,
      open: candle.open * factor,
      high: candle.high * factor,
      low: candle.low * factor,
      close: candle.close * factor,
    })),
    [factor, intervalSeconds, market.ticks],
  );
  const latestPrice = market.latest?.price * factor;

  if (candles.length === 0) {
    return (
      <div className="live-market-empty" role={market.error ? "alert" : "status"}>
        <strong>{market.status === "unconfigured" ? "Connect a live price feed" : "Waiting for live market ticks"}</strong>
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

  return (
    <div className="live-market-chart">
      <div className="live-market-toolbar">
        <div>
          <strong>{karat}K live candles · LKR per 8 g</strong>
          <span>
            {latestPrice ? `Latest indicative close ${priceLabel(latestPrice)}` : "Connected; collecting the first ticks"}
            {market.latest?.timestamp ? ` · updated ${formatTime(market.latest.timestamp * 1000)} SL time` : ""}
          </span>
          <span>Gold spot × USD/LKR × {karat}/24 purity · excludes local premiums and charges</span>
        </div>
        <div className="live-market-intervals" role="group" aria-label="Live candle interval">
          {LIVE_CANDLE_INTERVALS.map((interval) => (
            <button
              key={interval.label}
              type="button"
              aria-pressed={intervalSeconds === interval.seconds}
              onClick={() => setIntervalSeconds(interval.seconds)}
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
                  Rs {(value / 1000).toFixed(0)}k
                </text>
              </g>
            );
          })}
          {candles.map((candle, index) => {
            const rising = candle.close >= candle.open;
            const candleX = x(index);
            const bodyTop = y(Math.max(candle.open, candle.close));
            const bodyBottom = y(Math.min(candle.open, candle.close));
            return (
              <g key={candle.timestamp} className={`candle${rising ? " rising" : " falling"}`}>
                <title>
                  {`${formatTime(candle.timestamp)} · O ${priceLabel(candle.open)} · H ${priceLabel(candle.high)} · L ${priceLabel(candle.low)} · C ${priceLabel(candle.close)}`}
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
          <text x={left} y={height - 8} className="candle-axis-label">{formatTime(candles[0].timestamp)}</text>
          <text x={width - right} y={height - 8} textAnchor="end" className="candle-axis-label">
            {formatTime(last.timestamp)}
          </text>
        </svg>
      </div>
      <div className="market-candle-detail" aria-live="polite">
        <strong>{formatTime(last.timestamp)}</strong>
        <span>O {priceLabel(last.open)}</span>
        <span>H {priceLabel(last.high)}</span>
        <span>L {priceLabel(last.low)}</span>
        <span>C {priceLabel(latestPrice || last.close)}</span>
      </div>
      <p className="market-candle-basis">
        A live spot-derived estimate, not a quoted shop price or guaranteed trade. Candles only move when the price provider sends a new market update.
      </p>
    </div>
  );
}
