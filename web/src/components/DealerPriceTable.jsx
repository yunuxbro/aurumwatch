"use client";

import { useState } from "react";
import { daysSinceDate, todayInSriLanka } from "@/lib/date";

function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `Rs ${amount.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
}

function formatObserved(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString("en-LK", {
      timeZone: "Asia/Colombo",
      dateStyle: "medium",
      timeStyle: "short",
    });
}

function quoteAgeLabel(rateDate, today) {
  const age = daysSinceDate(rateDate, today);
  if (age == null) return { label: "Date unavailable", className: "dealer-age-unknown" };
  if (age < 0) return { label: "Future date", className: "dealer-age-unknown" };
  if (age === 0) return { label: "Today", className: "dealer-age-fresh" };
  if (age <= 2) return { label: `${age}d · recent`, className: "dealer-age-fresh" };
  if (age <= 7) return { label: `${age}d · aging`, className: "dealer-age-aging" };
  return { label: `${age}d · stale`, className: "dealer-age-stale" };
}

export default function DealerPriceTable({ items }) {
  const [search, setSearch] = useState("");
  const [karat, setKarat] = useState("all");
  const [side, setSide] = useState("all");
  const [includeOlder, setIncludeOlder] = useState(false);
  const today = todayInSriLanka();
  const karats = [...new Set(items.map((item) => item.karat))].sort((a, b) => b - a);
  const sides = [...new Set(items.map((item) => item.side))].sort();
  const filtered = items.filter((item) => {
    const searchMatches = item.institution.toLowerCase().includes(search.trim().toLowerCase());
    const age = daysSinceDate(item.rate_date, today);
    const isRecent = age != null && age >= 0 && age <= 7;
    return searchMatches
      && (karat === "all" || String(item.karat) === karat)
      && (side === "all" || item.side === side)
      && (includeOlder || isRecent);
  });

  return (
    <div className="dealer-table-wrap">
      <div className="dealer-filters">
        <label className="dealer-search">
          <span>Search dealer</span>
          <input
            className="input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="e.g. CMB Gold"
          />
        </label>
        <label className="dealer-select">
          <span>Karat</span>
          <select className="input" value={karat} onChange={(event) => setKarat(event.target.value)}>
            <option value="all">All karats</option>
            {karats.map((value) => <option key={value} value={value}>{value}K</option>)}
          </select>
        </label>
        <label className="dealer-select">
          <span>Price type</span>
          <select className="input" value={side} onChange={(event) => setSide(event.target.value)}>
            <option value="all">All types</option>
            {sides.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="dealer-stale-toggle">
          <input
            type="checkbox"
            checked={includeOlder}
            onChange={(event) => setIncludeOlder(event.target.checked)}
          />
          <span>Include rates older than 7 days</span>
        </label>
        <p className="dealer-result-count" aria-live="polite">
          Showing {filtered.length} of {items.length} prices
        </p>
      </div>

      <div className="scroll-x">
        <table className="data-table dealer-table">
          <thead>
            <tr>
              <th scope="col">Dealer</th>
              <th scope="col">Karat</th>
              <th scope="col">Price type</th>
              <th scope="col">Price / unit</th>
              <th scope="col">Rate date</th>
              <th scope="col">Observed</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, index) => {
              const age = quoteAgeLabel(item.rate_date, today);
              return (
                <tr key={`${item.institution}-${item.karat}-${item.side}-${item.unit}-${item.rate_date}-${index}`}>
                  <td>
                    <strong className="dealer-name">{item.institution}</strong>
                    <span className="dealer-type">{item.institution_type.replaceAll("_", " ")}</span>
                  </td>
                  <td>{item.karat}K</td>
                  <td><span className="dealer-side">{item.side}</span></td>
                  <td className="dealer-price">
                    <strong>{formatPrice(item.price_lkr)}</strong>
                    <span>{item.unit_label}</span>
                  </td>
                  <td>
                    <span>{item.rate_date || "—"}</span>
                    <span className={`dealer-age ${age.className}`}>{age.label}</span>
                  </td>
                  <td>{formatObserved(item.observed_at)}</td>
                  <td>
                    <a href={item.source_url} target="_blank" rel="noreferrer">
                      View source
                    </a>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  {includeOlder
                    ? "No prices match these filters."
                    : "No recent prices match these filters. Include older rates to see dated listings."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
