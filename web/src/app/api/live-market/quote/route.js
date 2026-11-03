export const dynamic = "force-dynamic";

const GOLD_PRICE_URL = "https://www.goldapi.io/api/price/XAU/LKR?melt_price=false&currency_info=false";
const FREE_PLAN_SAFE_INTERVAL_MS = 3 * 60 * 60 * 1000;
const MIN_POLL_INTERVAL_MS = 60 * 1000;
const MAX_POLL_INTERVAL_MS = 24 * 60 * 60 * 1000;

function configuredPollInterval() {
  const parsed = Number(process.env.GOLD_API_POLL_INTERVAL_MS);
  if (!Number.isFinite(parsed)) return FREE_PLAN_SAFE_INTERVAL_MS;
  return Math.max(MIN_POLL_INTERVAL_MS, Math.min(MAX_POLL_INTERVAL_MS, Math.floor(parsed)));
}

function quoteCache() {
  if (!globalThis.goldApiLkrQuoteCache) {
    globalThis.goldApiLkrQuoteCache = { value: null, fetchedAt: 0, pending: null };
  }
  return globalThis.goldApiLkrQuoteCache;
}

export async function GET(request) {
  const origin = request.headers.get("origin");
  let originUrl = null;
  try {
    if (origin) originUrl = new URL(origin);
  } catch {
    return Response.json({ message: "Live market quotes are only available to this site." }, { status: 403 });
  }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProtocol
    ? `${forwardedProtocol}:`
    : new URL(request.url).protocol;
  const sameOriginFetch = request.headers.get("sec-fetch-site") === "same-origin";
  if (
    !host ||
    (originUrl
      ? originUrl.host !== host || originUrl.protocol !== protocol
      : !sameOriginFetch)
  ) {
    return Response.json({ message: "Live market quotes are only available to this site." }, { status: 403 });
  }

  const apiKey = process.env.GOLD_API_KEY;
  if (!apiKey) {
    return Response.json({
      configured: false,
      message: "Add a GoldAPI REST key as GOLD_API_KEY to web/.env.local to enable periodic price updates.",
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const pollIntervalMs = configuredPollInterval();
  const cache = quoteCache();
  if (cache.value && Date.now() - cache.fetchedAt < pollIntervalMs) {
    return Response.json({
      ...cache.value,
      pollIntervalMs,
      cached: true,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!cache.pending) {
    cache.pending = (async () => {
      const response = await fetch(GOLD_PRICE_URL, {
        headers: {
          "x-access-token": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        console.error(`GoldAPI REST quote request failed with status ${response.status}.`);
        const error = new Error(
          response.status === 401 || response.status === 403
            ? "GoldAPI rejected the REST API key or account access. Replace it with a valid REST key."
            : `GoldAPI quote request failed (${response.status}).`,
        );
        error.status = response.status;
        throw error;
      }

      const quote = await response.json();
      const timestamp = Number(quote.timestamp);
      const priceLkrPerTroyOunce = Number(quote.price);
      if (
        quote.metal !== "XAU" ||
        quote.currency !== "LKR" ||
        !Number.isFinite(timestamp) ||
        !Number.isFinite(priceLkrPerTroyOunce) ||
        priceLkrPerTroyOunce <= 0
      ) {
        throw new Error("GoldAPI returned an invalid XAU/LKR quote.");
      }

      const value = {
        configured: true,
        mode: "rest",
        timestamp,
        priceLkrPerTroyOunce,
        providerSymbol: quote.symbol || "XAU/LKR",
        provider: "GoldAPI REST",
      };
      cache.value = value;
      cache.fetchedAt = Date.now();
      return value;
    })().finally(() => {
      cache.pending = null;
    });
  }

  try {
    const value = await cache.pending;
    return Response.json({
      ...value,
      pollIntervalMs,
      cached: false,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Could not retrieve GoldAPI XAU/LKR quote:", error);
    const message = error instanceof Error ? error.message : "Could not retrieve the live-market quote.";
    const status = error instanceof Error && (error.status === 401 || error.status === 403)
      ? error.status
      : 502;
    return Response.json({ configured: true, mode: "rest", message }, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
