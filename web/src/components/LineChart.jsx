"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { lkr } from "@/lib/format";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

function dateLabel(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-LK", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export default function LineChart({
  data = [],
  lines = [],
  markers = [],
  height = 320,
  dataUrl = "/data/history.json",
}) {
  const [points, setPoints] = useState(data);
  const [quoteMarkers, setQuoteMarkers] = useState(markers);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState("");

  useEffect(() => {
    setPoints(data);
    setQuoteMarkers(markers);
  }, [data, markers]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(dataUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load market history (${response.status}).`);
      const result = await response.json();
      if (!Array.isArray(result.rows)) throw new Error("Market history has no daily rows.");
      setPoints(result.rows);
      setQuoteMarkers(result.pettah_markers || []);
      setRefreshNote(`Updated from the published data through ${result.as_of_date || "the latest date"}.`);
    } catch (error) {
      setRefreshNote(error instanceof Error ? `${error.message} Showing the saved chart.` : "Showing the saved chart.");
    } finally {
      setRefreshing(false);
    }
  }, [dataUrl]);

  useEffect(() => {
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const chart = useMemo(() => {
    const valid = points.filter((point) => point.date && lines.some((line) => Number.isFinite(Number(point[line.key]))));
    if (!valid.length) return null;

    const times = valid.map((point) => Date.parse(`${point.date}T00:00:00Z`));
    const firstTime = Math.min(...times);
    const lastTime = Math.max(...times);
    const span = Math.max(1, lastTime - firstTime);
    const markerTimes = quoteMarkers.map((marker) => Date.parse(`${marker.market_date || marker.date}T00:00:00Z`));
    const values = [
      ...valid.flatMap((point) => lines.map((line) => Number(point[line.key])).filter(Number.isFinite)),
      ...quoteMarkers.map((marker) => Number(marker.price_lkr_per_8g)).filter(Number.isFinite),
    ];
    if (!values.length) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.08, Math.abs(max) * 0.002, 1);
    const low = min - padding;
    const high = max + padding;
    const width = 1000;
    const top = 28;
    const bottom = 66;
    const left = 108;
    const right = 24;
    const plotHeight = height - top - bottom;
    const plotWidth = width - left - right;
    const x = (time) => left + ((time - firstTime) / span) * plotWidth;
    const y = (value) => top + (1 - (value - low) / (high - low)) * plotHeight;
    const xTicks = Array.from({ length: 5 }, (_, index) => {
      const time = firstTime + span * index / 4;
      return { time, x: x(time), label: dateLabel(new Date(time).toISOString().slice(0, 10)) };
    });
    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const value = high - (high - low) * index / 4;
      return { value, y: y(value) };
    });
    const paths = lines.map((line) => {
      let segment = [];
      const segments = [];
      valid.forEach((point) => {
        const value = Number(point[line.key]);
        if (!Number.isFinite(value)) {
          if (segment.length) segments.push(segment);
          segment = [];
          return;
        }
        const time = Date.parse(`${point.date}T00:00:00Z`);
        segment.push(`${x(time).toFixed(2)},${y(value).toFixed(2)}`);
      });
      if (segment.length) segments.push(segment);
      return { ...line, segments };
    });
    const datedMarkers = quoteMarkers.flatMap((marker) => {
      const time = Date.parse(`${marker.market_date || marker.date}T00:00:00Z`);
      const value = Number(marker.price_lkr_per_8g);
      return Number.isFinite(time) && Number.isFinite(value) && time >= firstTime && time <= lastTime
        ? [{ ...marker, x: x(time), y: y(value) }]
        : [];
    });
    return { width, height, top, bottom, left, right, plotHeight, plotWidth, xTicks, yTicks, paths, markers: datedMarkers };
  }, [height, lines, points, quoteMarkers]);

  if (!chart) return <p className="text-muted p-4 text-center">No chart data available.</p>;

  return (
    <div className="history-chart">
      <div className="history-chart-toolbar">
        <div className="history-chart-legend">
          {lines.map((line) => (
            <span key={line.key} style={{ color: line.color }}><i style={{ background: line.color }} />{line.label}</span>
          ))}
          {quoteMarkers.length > 0 && <span className="pettah-chart-legend"><i />Pettah report</span>}
        </div>
        <button className="btn btn-secondary" type="button" onClick={refresh} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh graph"}
        </button>
      </div>
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="history-line-chart" role="img" aria-label="Daily 22K world-equivalent price with dated Pettah report markers">
        {chart.yTicks.map((tick, index) => (
          <g key={`y-${index}`}>
            <line x1={chart.left} x2={chart.width - chart.right} y1={tick.y} y2={tick.y} className="history-chart-grid" />
            <text x={chart.left - 12} y={tick.y + 4} textAnchor="end" className="history-chart-label">{lkr(tick.value)}</text>
          </g>
        ))}
        {chart.xTicks.map((tick, index) => (
          <g key={`x-${index}`}>
            <line x1={tick.x} x2={tick.x} y1={chart.top} y2={chart.height - chart.bottom} className="history-chart-grid history-chart-grid-x" />
            <text x={tick.x} y={chart.height - 38} textAnchor="middle" className="history-chart-label">{tick.label}</text>
          </g>
        ))}
        {chart.paths.flatMap((line) => line.segments.map((segment, index) => (
          <polyline
            key={`${line.key}-${index}`}
            points={segment.join(" ")}
            fill="none"
            stroke={line.color}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )))}
        {chart.markers.map((marker, index) => (
          <g key={`${marker.date}-${index}`} className="history-pettah-marker">
            <circle cx={marker.x} cy={marker.y} r="5" />
            <title>{`${marker.date} Pettah report: ${lkr(marker.price_lkr_per_8g)} per 8 g${marker.lag_days ? `; market close lag ${marker.lag_days} day` : ""}`}</title>
          </g>
        ))}
        <text x={chart.left + chart.plotWidth / 2} y={chart.height - 8} textAnchor="middle" className="history-chart-axis-title">Date</text>
        <text transform={`translate(22 ${chart.top + chart.plotHeight / 2}) rotate(-90)`} textAnchor="middle" className="history-chart-axis-title">LKR per 8 g</text>
      </svg>
      {refreshNote && <p className="section-sub" role="status">{refreshNote}</p>}
    </div>
  );
}
