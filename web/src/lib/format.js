export const pct = (v, d = 1) => (v == null ? "–" : (v * 100).toFixed(d) + "%");
export const lkr = (v) => (v == null ? "–" : "Rs " + Math.round(v).toLocaleString("en-US"));