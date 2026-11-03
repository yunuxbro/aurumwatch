export function todayInSriLanka(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function daysSinceDate(date, today = todayInSriLanka()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return null;
  }
  const dateValue = Date.parse(`${date}T00:00:00Z`);
  const todayValue = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(dateValue) || !Number.isFinite(todayValue)) return null;
  return Math.round((todayValue - dateValue) / 86_400_000);
}
