"use client";

import { useEffect, useRef, useState } from "react";
import { goldSpotToLkrPer8g } from "@/lib/live-market";

const CHANNELS = ["metals:XAUUSD", "fx:USDLKR"];
const MAX_TICKS = 5000;

function channelPrice(message) {
  const price = Number(message.data?.price);
  const sourceTimestamp = Number(message.data?.timestamp ?? message.publishedAt);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(sourceTimestamp)) return null;
  return { price, timestamp: sourceTimestamp };
}

export function useLiveMarket() {
  const [status, setStatus] = useState("loading");
  const [configured, setConfigured] = useState(null);
  const [error, setError] = useState("");
  const [ticks, setTicks] = useState([]);
  const [latest, setLatest] = useState(null);
  const tickState = useRef({ gold: null, fx: null, lastPair: "" });

  useEffect(() => {
    let stopped = false;
    let socket = null;
    let heartbeat = null;
    let retryTimer = null;
    let retryCount = 0;
    let subscriptionIds = new Set();

    function send(message) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    }

    async function connect() {
      if (stopped) return;
      setStatus(retryCount ? "reconnecting" : "connecting");
      try {
        const response = await fetch("/api/live-market/token", {
          method: "POST",
          cache: "no-store",
        });
        const details = await response.json();
        if (stopped) return;
        setConfigured(Boolean(details.configured));
        if (!response.ok) {
          if (!details.configured) {
            setStatus("unconfigured");
            setError(details.message || "Configure a live-market provider key to enable streaming.");
            return;
          }
          const connectionError = new Error(details.message || `Live price connection failed (${response.status}).`);
          connectionError.retryable = details.retryable === true;
          throw connectionError;
        }

        setError("");
        socket = new WebSocket(details.websocketUrl);
        socket.addEventListener("open", () => {
          send({
            type: "auth",
            token: details.token,
            requestId: `aurumwatch-auth-${Date.now()}`,
          });
          heartbeat = window.setInterval(() => {
            send({ type: "ping", requestId: `aurumwatch-ping-${Date.now()}` });
          }, 25_000);
        });
        socket.addEventListener("message", (event) => {
          let message;
          try {
            message = JSON.parse(event.data);
          } catch {
            setError("The live price provider sent an unreadable message.");
            return;
          }

          if (message.type === "authenticated") {
            send({
              type: "subscribe",
              channels: CHANNELS,
              requestId: `aurumwatch-subscribe-${Date.now()}`,
            });
          } else if (message.type === "subscribed") {
            for (const channel of message.channels || []) subscriptionIds.add(channel);
            if (CHANNELS.every((channel) => subscriptionIds.has(channel))) {
              retryCount = 0;
              setStatus("live");
            }
          } else if (message.type === "price.update") {
            const quote = channelPrice(message);
            if (!quote) {
              setError("The live price update did not contain a valid price and timestamp.");
              return;
            }

            if (message.channel === "metals:XAUUSD") tickState.current.gold = quote;
            if (message.channel === "fx:USDLKR") tickState.current.fx = quote;
            const { gold, fx } = tickState.current;
            if (!gold || !fx) return;

            const pairKey = `${gold.timestamp}:${gold.price}:${fx.timestamp}:${fx.price}`;
            if (pairKey === tickState.current.lastPair) return;
            tickState.current.lastPair = pairKey;
            const price = goldSpotToLkrPer8g(gold.price, fx.price);
            if (!price) return;

            const tick = {
              timestamp: Math.max(gold.timestamp, fx.timestamp),
              price,
            };
            setLatest({ ...tick, goldUsd: gold.price, usdLkr: fx.price });
            setTicks((current) => [...current, tick].slice(-MAX_TICKS));
            setError("");
          } else if (message.type === "error") {
            setError(message.message || `Live price provider error: ${message.code || "unknown error"}.`);
            if (message.code === "TOKEN_EXPIRED") socket.close(4001, "Token expired");
          }
        });
        socket.addEventListener("error", () => {
          setError("The live price WebSocket encountered a connection error.");
        });
        socket.addEventListener("close", (event) => {
          if (heartbeat) window.clearInterval(heartbeat);
          heartbeat = null;
          subscriptionIds = new Set();
          if (stopped) return;
          setStatus("reconnecting");
          setError(event.code === 4001
            ? "Refreshing the expired live connection."
            : "Live connection closed; retrying.");
          retryCount += 1;
          const delay = Math.min(30_000, 1000 * 2 ** Math.min(retryCount - 1, 5));
          retryTimer = window.setTimeout(connect, delay);
        });
      } catch (connectionError) {
        if (stopped) return;
        setStatus("error");
        setError(connectionError instanceof Error ? connectionError.message : "Could not connect to live prices.");
        if (connectionError instanceof Error && connectionError.retryable === false) return;
        retryCount += 1;
        retryTimer = window.setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(retryCount - 1, 5)));
      }
    }

    connect();
    return () => {
      stopped = true;
      if (heartbeat) window.clearInterval(heartbeat);
      if (retryTimer) window.clearTimeout(retryTimer);
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    };
  }, []);

  return { status, configured, error, ticks, latest };
}
