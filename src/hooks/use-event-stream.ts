import { useEffect, useMemo, useState } from "react";
import type { FeedItem, MarkerPoint, OrbitalEvent } from "../types";

const PLATFORM_COLORS: Record<string, [number, number, number]> = {
  javascript: [0.76, 0.38, 1],
  node: [0.26, 0.8, 0.58],
  python: [0.31, 0.58, 1],
  java: [0.95, 0.54, 0.17],
  cocoa: [1, 0.42, 0.75],
  php: [0.53, 0.58, 0.99],
  csharp: [0.55, 0.75, 0.19],
  ruby: [1, 0.33, 0.38],
  go: [0.22, 0.84, 0.91],
  native: [0.99, 0.81, 0.19],
  elixir: [0.75, 0.45, 1],
};

const DEFAULT_COLOR: [number, number, number] = [0.62, 0.53, 1];
const FEED_LIMIT_DESKTOP = 12;
const FEED_LIMIT_MOBILE = 5;
const MARKER_LIMIT = 36;
const MARKER_TTL_MS = 2_600;
const MARKER_RATE_MS = 170;
const MARKER_MAX_PER_MESSAGE = 3;
const MOBILE_WIDTH = 640;
const EXTERNAL_STREAM_URL =
  import.meta.env.VITE_SENTRY_ORBITAL_STREAM_URL ?? "https://sentry.live/stream";
const WATCHDOG_MS = 5000;
const RETRY_MS = 3000;

function toMarker(event: OrbitalEvent): MarkerPoint {
  const markerId = `evt-${event.ts}-${Math.random().toString(16).slice(2)}`;

  return {
    id: markerId,
    lat: event.lat,
    lng: event.lng,
    createdAt: Date.now(),
    color: PLATFORM_COLORS[event.platform] ?? DEFAULT_COLOR,
  };
}

function toFeed(event: OrbitalEvent): FeedItem {
  return {
    id: `${event.ts}-${Math.random().toString(16).slice(2)}`,
    platform: event.platform,
    lat: event.lat,
    lng: event.lng,
  };
}

function asEventTuple(input: unknown): OrbitalEvent | null {
  if (!Array.isArray(input)) {
    return null;
  }

  const [lat, lng, ts, platform] = input;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    typeof ts !== "number" ||
    typeof platform !== "string"
  ) {
    return null;
  }

  return { lat, lng, ts, platform };
}

function asEventObject(input: unknown): OrbitalEvent | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const event = input as Partial<OrbitalEvent>;
  if (
    typeof event.lat !== "number" ||
    typeof event.lng !== "number" ||
    typeof event.platform !== "string" ||
    typeof event.ts !== "number"
  ) {
    return null;
  }

  return {
    lat: event.lat,
    lng: event.lng,
    platform: event.platform,
    ts: event.ts,
  };
}

function extractEvents(payload: unknown): OrbitalEvent[] {
  if (Array.isArray(payload)) {
    const tuple = asEventTuple(payload);
    if (tuple) {
      return [tuple];
    }

    const batchedTuples = payload
      .map((item) => asEventTuple(item))
      .filter((item): item is OrbitalEvent => item !== null);

    if (batchedTuples.length > 0) {
      return batchedTuples;
    }

    const batchedObjects = payload
      .map((item) => asEventObject(item))
      .filter((item): item is OrbitalEvent => item !== null);

    return batchedObjects;
  }

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    if ("heartbeat" in payload || "connected" in payload) {
      return [];
    }

    if ("events" in payload) {
      const eventsPayload = (payload as { events?: unknown }).events;
      if (!Array.isArray(eventsPayload)) {
        return [];
      }

      return eventsPayload
        .map((item) => asEventObject(item) ?? asEventTuple(item))
        .filter((item): item is OrbitalEvent => item !== null);
    }

    const single = asEventObject(payload);
    return single ? [single] : [];
  }

  return [];
}

export function useEventStream() {
  const [sampled, setSampled] = useState(0);
  const [markers, setMarkers] = useState<MarkerPoint[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [streamUrl, setStreamUrl] = useState(EXTERNAL_STREAM_URL);
  const [usesExternalStream, setUsesExternalStream] = useState(true);
  const [reconnectTick, setReconnectTick] = useState(0);

  useEffect(() => {
    const source = new EventSource(streamUrl);
    let lastMarkerAt = Date.now();
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const clearTimers = () => {
      if (watchdogTimer !== null) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
    };

    const forceReconnect = (delay: number) => {
      if (closed) {
        return;
      }

      setTimeout(() => {
        if (closed) {
          return;
        }
        source.close();
        setReconnectTick((tick) => tick + 1);
      }, delay);
    };

    const resetWatchdog = () => {
      if (watchdogTimer !== null) {
        clearTimeout(watchdogTimer);
      }

      watchdogTimer = setTimeout(() => {
        setIsConnected(false);
        forceReconnect(RETRY_MS);
      }, WATCHDOG_MS);
    };

    source.onopen = () => {
      setIsConnected(true);
      resetWatchdog();
    };

    source.onerror = () => {
      setIsConnected(false);
    };

    source.onmessage = (message) => {
      resetWatchdog();

      let parsed: unknown;
      try {
        parsed = JSON.parse(message.data);
      } catch {
        return;
      }

      const events = extractEvents(parsed);
      if (events.length === 0) {
        return;
      }

      const now = Date.now();
      const fresh = events
        .filter((event) => now - event.ts <= 10_000)
        .sort((a, b) => a.ts - b.ts);
      if (fresh.length === 0) {
        return;
      }

      setSampled((current) => current + fresh.length);

      const allowedAdds = Math.min(
        fresh.length,
        Math.max(0, Math.floor((now - lastMarkerAt) / MARKER_RATE_MS)),
        MARKER_MAX_PER_MESSAGE,
      );
      const markerAdds = allowedAdds > 0 ? fresh.slice(0, allowedAdds) : [];
      if (allowedAdds > 0) {
        lastMarkerAt += allowedAdds * MARKER_RATE_MS;
      }

      if (markerAdds.length > 0) {
        setMarkers((current) => {
          const alive = current.filter((marker) => now - marker.createdAt < MARKER_TTL_MS);
          const next = [...alive, ...markerAdds.map((event) => toMarker(event))];
          return next.slice(-MARKER_LIMIT);
        });
      }

      setFeed((current) => {
        const mobile = window.innerWidth <= MOBILE_WIDTH;
        const limit = mobile ? FEED_LIMIT_MOBILE : FEED_LIMIT_DESKTOP;
        const next = [...fresh.slice().reverse().map((event) => toFeed(event)), ...current];
        return next.slice(0, limit);
      });
    };

    return () => {
      closed = true;
      clearTimers();
      source.close();
    };
  }, [streamUrl, reconnectTick]);

  useEffect(() => {
    if (streamUrl !== EXTERNAL_STREAM_URL) {
      return;
    }

    const timeout = setTimeout(() => {
      if (!isConnected) {
        setStreamUrl("/api/stream");
        setUsesExternalStream(false);
      }
    }, 3500);

    return () => {
      clearTimeout(timeout);
    };
  }, [isConnected, streamUrl]);

  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setMarkers((current) => current.filter((marker) => now - marker.createdAt < MARKER_TTL_MS));
    }, 800);

    return () => {
      clearInterval(cleanup);
    };
  }, []);

  const sampledLabel = useMemo(() => sampled.toLocaleString(), [sampled]);

  return {
    sampled,
    sampledLabel,
    markers,
    feed,
    isConnected,
    usesExternalStream,
    streamUrl,
  };
}
