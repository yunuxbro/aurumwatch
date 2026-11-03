"use client";

import { useMemo, useState } from "react";
import LiveMarketCandles from "./LiveMarketCandles";
import { useLiveMarket } from "@/hooks/useLiveMarket";

const RANGES = [
  { label: "1M", days: 31 },
  { label: "3M", days: 92 },
  { label: "6M", days: 183 },
  { label: "1Y", days: 366 },
  { label: "All", days: 0 },
];

function priceLabel(value) {
  return `Rs ${Math.round(value).toLocaleString("en-LK")}`;
}

function shortPriceLabel(value) {
  return `Rs ${(value / 1000).toFixed(0)}k`;
}

function HistoricalMarketCandles({
  snapshot,
  dealerReference,
  localQuotes = [],
  selectedKarat,
}) {
  const [rangeDays, setRangeDays] = useState(366);
  const [focusedDate, setFocusedDate] = useState(null);
  const rows = snapshot?.rows;
  const data = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const visibleData = useMemo(() => {
    if (!rangeDays || data.length === 0) return data;
    const lastDate = Date.parse(`${data.at(-1).date}T00:00:00Z`);
    const firstDate = lastDate - rangeDays * 86_400_000;
    return data.filter((row) => Date.parse(`${row.date}T00:00:00Z`) >= firstDate);
  }, [data, rangeDays]);
  const chartRows = useMemo(() => visibleData.map((row) => {
    const value = (field) => {
      const karatValue = Number(row[`${field}_${selectedKarat}k`]);
      if (Number.isFinite(karatValue)) return karatValue;
      const baseValue = Number(row[field]);
      return selectedKarat === 24 ? baseValue * 24 / 22 : baseValue;
    };
    return {
      ...row,
      chartOpen: value("open"),
      chartHigh: value("high"),
      chartLow: value("low"),
      chartClose: value("close"),
    };
  }), [visibleData, selectedKarat]);
  const quotePoints = useMemo(() => {
    if (!Array.isArray(localQuotes) || chartRows.length === 0) return [];
    return localQuotes.flatMap((quote) => {
      if (Number(quote.karat) !== selectedKarat || !Number.isFinite(quote.price_lkr_per_8g)) return [];
      const quoteTime = Date.parse(`${quote.date}T00:00:00Z`);
      let start = 0;
      let end = chartRows.length;
      while (start < end) {
        const middle = Math.floor((start + end) / 2);
        if (Date.parse(`${chartRows[middle].date}T00:00:00Z`) <= quoteTime) start = middle + 1;
        else end = middle;
      }
      const index = start - 1;
      if (index < 0) return [];
      const candleTime = Date.parse(`${chartRows[index].date}T00:00:00Z`);
      if (quoteTime - candleTime > 5 * 86_400_000) return [];
      return [{ ...quote, index, candleDate: chartRows[index].date }];
    });
  }, [chartRows, localQuotes, selectedKarat]);

  if (chartRows.length === 0) {
    return (
      <p className="market-candle-empty" role="status">
        {snapshot?.reason || "Daily gold/FX candle data is not available yet. Run a market refresh to build it."}
      </p>
    );
  }

  const selected = chartRows.find((row) => row.date === focusedDate) || chartRows.at(-1);
  const selectedLocalQuotes = quotePoints.filter((point) => point.candleDate === selected.date);
  const dealerPrice = selectedKarat === 22 && Number.isFinite(dealerReference?.price_lkr_per_8g)
    ? dealerReference.price_lkr_per_8g
    : null;
  const rangeValues = chartRows.flatMap((row) => [row.chartLow, row.chartHigh]);
  quotePoints.forEach((point) => rangeValues.push(point.price_lkr_per_8g));
  if (dealerPrice != null) rangeValues.push(dealerPrice);
  const min = Math.min(...rangeValues);
  const max = Math.max(...rangeValues);
  const room = Math.max((max - min) * 0.08, max * 0.002);
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
  const step = plotWidth / chartRows.length;
  const candleWidth = Math.max(2, Math.min(12, step * 0.62));
  const x = (index) => left + (index + 0.5) * step;
  const y = (value) => top + (1 - (value - low) / (high - low)) * plotHeight;
  const displayedRows = chartRows.slice(-8).reverse();

  return (
    <div className="market-candle-widget">
      <div className="market-candle-toolbar">
        <div>
          <strong>{selectedKarat}K daily candles · LKR per 8 g</strong>
          <span>Latest {selectedKarat}K close: {priceLabel(chartRows.at(-1).chartClose)}</span>
          <span className="market-candle-legend">
            <i className="legend-candle" /> {selectedKarat}K OHLC
            <i className="legend-pettah" /> Pettah report
            <i className="legend-dealer" /> Published dealer listing
          </span>
        </div>
        <div className="market-candle-controls">
          <div className="market-candle-ranges" role="group" aria-label="Candle chart date range">
            {RANGES.map((range) => (
              <button
                key={range.label}
                type="button"
                aria-pressed={rangeDays === range.days}
                onClick={() => setRangeDays(range.days)}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="market-candle-chart-wrap">
        <svg
          className="market-candle-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Daily ${selectedKarat} karat Sri Lankan rupee benchmark with dated Pettah and dealer observations`}
        >
          {[0, 1, 2, 3].map((index) => {
            const value = high - ((high - low) * index) / 3;
            const lineY = y(value);
            return (
              <g key={index}>
                <line x1={left} x2={width - right} y1={lineY} y2={lineY} className="candle-grid" />
                <text x={left - 10} y={lineY + 4} textAnchor="end" className="candle-axis-label">
                  {shortPriceLabel(value)}
                </text>
              </g>
            );
          })}
          {dealerPrice != null && (
            <g className="dealer-reference-line">
              <title>
                {`Published 22K dealer guide ${priceLabel(dealerPrice)} on ${dealerReference.rate_date}`}
              </title>
              <line x1={left} x2={width - right} y1={y(dealerPrice)} y2={y(dealerPrice)} />
              <text x={width - right - 4} y={y(dealerPrice) - 5} textAnchor="end">
                Dealer {shortPriceLabel(dealerPrice)}
              </text>
            </g>
          )}
          {chartRows.map((row, index) => {
            const rising = row.chartClose >= row.chartOpen;
            const bodyTop = y(Math.max(row.chartOpen, row.chartClose));
            const bodyBottom = y(Math.min(row.chartOpen, row.chartClose));
            const candleX = x(index);
            return (
              <g
                key={row.date}
                className={`candle${rising ? " rising" : " falling"}`}
                tabIndex={0}
                role="button"
                aria-label={`${row.date}: ${selectedKarat}K open ${priceLabel(row.chartOpen)}, high ${priceLabel(row.chartHigh)}, low ${priceLabel(row.chartLow)}, close ${priceLabel(row.chartClose)}`}
                onFocus={() => setFocusedDate(row.date)}
                onMouseEnter={() => setFocusedDate(row.date)}
              >
                <title>
                  {`${row.date} · ${selectedKarat}K · O ${priceLabel(row.chartOpen)} · H ${priceLabel(row.chartHigh)} · L ${priceLabel(row.chartLow)} · C ${priceLabel(row.chartClose)}`}
                </title>
                <line
                  x1={candleX}
                  x2={candleX}
                  y1={y(row.chartHigh)}
                  y2={y(row.chartLow)}
                  className="candle-wick"
                />
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
          {quotePoints.map((point) => (
            <g
              key={`${point.date}-${point.karat}-${point.source_type}`}
              className={`local-quote-marker ${point.source_type === "pettah" ? "pettah" : "dealer"}`}
            >
              <title>
                {`${point.date} · ${point.source} · ${point.karat}K · ${priceLabel(point.price_lkr_per_8g)} · ${point.contributors.join(", ")}`}
              </title>
              {point.source_type === "pettah" ? (
                <circle cx={x(point.index)} cy={y(point.price_lkr_per_8g)} r="5" />
              ) : (
                <rect x={x(point.index) - 4} y={y(point.price_lkr_per_8g) - 4} width="8" height="8" rx="1" />
              )}
            </g>
          ))}
          <text x={left} y={height - 8} className="candle-axis-label">{chartRows[0].date}</text>
          <text x={width - right} y={height - 8} textAnchor="end" className="candle-axis-label">
            {chartRows.at(-1).date}
          </text>
        </svg>
      </div>

      <div className="market-candle-detail" aria-live="polite">
        <strong>{selected.date}</strong>
        <span>{selectedKarat}K O {priceLabel(selected.chartOpen)}</span>
        <span>H {priceLabel(selected.chartHigh)}</span>
        <span>L {priceLabel(selected.chartLow)}</span>
        <span>C {priceLabel(selected.chartClose)}</span>
      </div>
      {selectedLocalQuotes.length > 0 && (
        <div className="market-candle-local-quotes" aria-live="polite">
          {selectedLocalQuotes.map((quote) => (
            <span key={`${quote.date}-${quote.karat}-${quote.source_type}`}>
              <strong>{quote.source}</strong> · {quote.date} · {quote.karat}K {priceLabel(quote.price_lkr_per_8g)}
              {quote.contributors.length ? ` · ${quote.contributors.join(", ")}` : ""}
            </span>
          ))}
        </div>
      )}
      <p className="market-candle-basis">
        {snapshot?.basis || "Prices are daily feed-derived benchmarks, not live ticks or local shop offers."}
      </p>

      <div className="market-candle-table-wrap">
        <table className="market-candle-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Open</th>
              <th scope="col">High</th>
              <th scope="col">Low</th>
              <th scope="col">{selectedKarat}K close</th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>{priceLabel(row.chartOpen)}</td>
                <td>{priceLabel(row.chartHigh)}</td>
                <td>{priceLabel(row.chartLow)}</td>
                <td>{priceLabel(row.chartClose)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MarketCandles({ snapshot, dealerReference, localQuotes = [] }) {
  const [selectedKarat, setSelectedKarat] = useState(22);
  const [manualChartMode, setManualChartMode] = useState(null);
  const market = useLiveMarket();
  const chartMode = manualChartMode || (market.configured ? "live" : "history");

  const statusLabel = {
    loading: "Checking live feed",
    connecting: "Connecting to live feed",
    live: "Live feed connected",
    reconnecting: "Reconnecting to live feed",
    unconfigured: "Daily data · live feed not configured",
    error: "Live feed unavailable",
  }[market.status] || "Live feed status unknown";

  return (
    <div className="market-chart-panel">
      <div className="market-chart-panel-toolbar">
        <div className="market-chart-mode" role="group" aria-label="Market chart mode">
          <button
            type="button"
            aria-pressed={chartMode === "live"}
            onClick={() => setManualChartMode("live")}
          >
            Live
          </button>
          <button
            type="button"
            aria-pressed={chartMode === "history"}
            onClick={() => setManualChartMode("history")}
          >
            Daily history
          </button>
        </div>
        <div className="market-candle-ranges" role="group" aria-label="Gold purity">
          {[22, 24].map((karat) => (
            <button
              key={karat}
              type="button"
              aria-pressed={selectedKarat === karat}
              onClick={() => setSelectedKarat(karat)}
            >
              {karat}K
            </button>
          ))}
        </div>
        <span className={`live-market-status ${market.status}`} aria-live="polite">
          <i aria-hidden="true" />
          {statusLabel}
        </span>
      </div>
      {chartMode === "live" ? (
        <LiveMarketCandles market={market} karat={selectedKarat} />
      ) : (
        <HistoricalMarketCandles
          snapshot={snapshot}
          dealerReference={dealerReference}
          localQuotes={localQuotes}
          selectedKarat={selectedKarat}
        />
      )}
    </div>
  );
}
