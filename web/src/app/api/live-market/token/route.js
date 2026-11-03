export const dynamic = "force-dynamic";

const TOKEN_URL = "https://www.goldapi.io/api/ws/token";
const TOKEN_REFRESH_MARGIN_MS = 60_000;

function tokenCache() {
  if (!globalThis.goldApiWebSocketToken) {
    globalThis.goldApiWebSocketToken = { value: null, pending: null };
  }
  return globalThis.goldApiWebSocketToken;
}

export async function POST(request) {
  const origin = request.headers.get("origin");
  let originUrl = null;
  try {
    if (origin) originUrl = new URL(origin);
  } catch {
    return Response.json({ message: "Live market tokens are only available to this site." }, { status: 403 });
  }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProtocol
    ? `${forwardedProtocol}:`
    : new URL(request.url).protocol;
  if (!originUrl || !host || originUrl.host !== host || originUrl.protocol !== protocol) {
    return Response.json({ message: "Live market tokens are only available to this site." }, { status: 403 });
  }

  const restApiKey = process.env.GOLD_API_KEY;
  const pollIntervalMs = Number(process.env.GOLD_API_POLL_INTERVAL_MS);
  const safePollIntervalMs = Number.isFinite(pollIntervalMs)
    ? Math.max(60_000, Math.min(24 * 60 * 60 * 1000, Math.floor(pollIntervalMs)))
    : 3 * 60 * 60 * 1000;
  const apiKey = process.env.GOLD_API_WS_KEY;
  if (!apiKey) {
    if (restApiKey) {
      return Response.json({
        configured: true,
        mode: "rest",
        pollIntervalMs: safePollIntervalMs,
      }, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return Response.json({
      configured: false,
      message: "Add a GoldAPI REST key as GOLD_API_KEY or a dedicated WebSocket key as GOLD_API_WS_KEY to web/.env.local.",
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const cache = tokenCache();
  const now = Date.now();
  if (cache.value && cache.value.expiresAt - TOKEN_REFRESH_MARGIN_MS > now) {
    return Response.json(cache.value, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!cache.pending) {
    cache.pending = (async () => {
      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          "x-ws-api-key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        console.error(`GoldAPI WebSocket token request failed with status ${response.status}.`);
        const error = new Error(`The live price provider rejected the WebSocket key or plan (${response.status}).`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }

      const token = await response.json();
      const expiresAt = Date.parse(token.expiresAt);
      const websocketUrl = new URL(token.websocketUrl);
      if (
        typeof token.token !== "string" ||
        !token.token ||
        !Number.isFinite(expiresAt) ||
        websocketUrl.protocol !== "wss:" ||
        websocketUrl.hostname !== "ws.goldapi.io"
      ) {
        throw new Error("The live price provider returned an invalid WebSocket token.");
      }

      cache.value = {
        configured: true,
        mode: "websocket",
        token: token.token,
        expiresAt: token.expiresAt,
        websocketUrl: websocketUrl.toString(),
      };
      return cache.value;
    })().finally(() => {
      cache.pending = null;
    });
  }

  try {
    const value = await cache.pending;
    return Response.json(value, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Could not obtain a GoldAPI WebSocket token:", error);
    if (restApiKey && error instanceof Error && error.retryable === false) {
      return Response.json({
        configured: true,
        mode: "rest",
        pollIntervalMs: safePollIntervalMs,
      }, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const message = error instanceof Error ? error.message : "Could not connect to the live price provider.";
    return Response.json({
      configured: true,
      message,
      retryable: error instanceof Error && error.retryable === true,
    }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
