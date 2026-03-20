import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import type { ViteDevServer } from "vite";

type OrbitalEvent = {
  lat: number;
  lng: number;
  ts: number;
  platform: string;
};

const app = new Hono<{ Bindings: { vite?: ViteDevServer } }>();
const encoder = new TextEncoder();

const platforms = [
  "javascript",
  "javascript",
  "javascript",
  "node",
  "node",
  "python",
  "python",
  "java",
  "java",
  "cocoa",
  "php",
  "csharp",
  "ruby",
  "go",
  "native",
  "elixir",
];

const cities: Array<[number, number]> = [
  [40.7, -74.0],
  [37.8, -122.4],
  [51.5, -0.1],
  [48.9, 2.3],
  [52.5, 13.4],
  [35.7, 139.7],
  [39.9, 116.4],
  [31.2, 121.5],
  [-33.9, 151.2],
  [-23.5, -46.6],
  [19.1, 72.9],
  [12.9, 77.6],
  [30.0, 31.2],
  [6.5, 3.4],
  [19.4, -99.1],
  [-34.6, -58.4],
  [55.8, 37.6],
  [41.0, 29.0],
  [37.6, 127.0],
  [1.3, 103.8],
  [25.2, 55.3],
  [43.7, -79.4],
  [41.9, -87.6],
  [34.1, -118.2],
  [47.6, -122.3],
  [25.8, -80.2],
  [52.4, 4.9],
  [59.3, 18.1],
  [40.4, -3.7],
  [41.9, 12.5],
  [22.3, 114.2],
  [-6.2, 106.8],
  [13.8, 100.5],
  [-1.3, 36.8],
  [-33.9, 18.4],
  [4.7, -74.1],
  [-12.0, -77.0],
  [-33.5, -70.6],
  [45.5, -73.6],
  [50.1, 8.7],
  [53.3, -6.3],
  [59.9, 10.8],
  [60.2, 25.0],
  [47.4, 8.5],
  [50.9, 4.4],
  [38.7, -9.1],
  [37.9, 23.7],
  [50.1, 14.4],
  [47.5, 19.1],
  [52.2, 21.0],
  [59.4, 24.7],
  [23.1, 113.3],
  [28.6, 77.2],
  [24.9, 67.0],
  [23.8, 90.4],
  [3.1, 101.7],
  [14.6, 121.0],
  [10.8, 106.7],
  [5.6, -0.2],
  [9.1, 7.4],
  [-26.2, 28.0],
  [32.1, 34.8],
  [33.9, 35.5],
  [33.3, 44.4],
  [35.7, 51.4],
  [41.3, 69.3],
  [43.3, 76.9],
  [47.9, 106.9],
  [-36.9, 174.8],
  [-27.5, 153.0],
  [-31.9, 115.9],
  [-37.8, 145.0],
  [21.3, -157.8],
  [61.2, -149.9],
  [49.3, -123.1],
  [51.0, -114.1],
  [53.5, -113.5],
];

const clients = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
let simulating = true;
let simulationTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

const jsonSse = (payload: unknown) =>
  encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

const normalizeEvent = (input: unknown): OrbitalEvent | null => {
  if (!input || typeof input !== "object") {
    return null;
  }

  const event = input as Partial<OrbitalEvent>;
  if (
    typeof event.lat !== "number" ||
    typeof event.lng !== "number" ||
    typeof event.platform !== "string"
  ) {
    return null;
  }

  return {
    lat: event.lat,
    lng: event.lng,
    platform: event.platform,
    ts: typeof event.ts === "number" ? event.ts : Date.now(),
  };
};

const createEvent = (): OrbitalEvent => {
  const city = cities[Math.floor(Math.random() * cities.length)];
  return {
    lat: city[0] + (Math.random() - 0.5) * 2,
    lng: city[1] + (Math.random() - 0.5) * 2,
    ts: Date.now(),
    platform: platforms[Math.floor(Math.random() * platforms.length)],
  };
};

const broadcast = (payload: unknown) => {
  const frame = jsonSse(payload);
  for (const [id, controller] of clients.entries()) {
    try {
      controller.enqueue(frame);
    } catch {
      clients.delete(id);
    }
  }
};

const startHeartbeat = () => {
  if (heartbeatTimer) {
    return;
  }
  heartbeatTimer = setInterval(() => {
    broadcast({ heartbeat: true, ts: Date.now() });
  }, 15000);
};

const stopHeartbeat = () => {
  if (!heartbeatTimer) {
    return;
  }
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
};

const startSimulation = () => {
  simulating = true;
  if (simulationTimer) {
    return;
  }

  simulationTimer = setInterval(() => {
    broadcast(createEvent());
  }, 80);
};

const stopSimulation = () => {
  simulating = false;
  if (!simulationTimer) {
    return;
  }

  clearInterval(simulationTimer);
  simulationTimer = null;
};

startSimulation();

app.get("/api/healthz", (c) => c.json({ ok: true, ts: Date.now() }));

app.get("/api/stream", () => {
  const id = crypto.randomUUID();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      clients.set(id, controller);
      startHeartbeat();
      controller.enqueue(encoder.encode("retry: 2000\n\n"));
      controller.enqueue(jsonSse({ connected: true, ts: Date.now() }));
    },
    cancel() {
      clients.delete(id);
      if (clients.size === 0) {
        stopHeartbeat();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
});

app.post("/api/events", async (c) => {
  const event = normalizeEvent(await c.req.json());
  if (!event) {
    return c.json({ ok: false, error: "invalid payload" }, 400);
  }

  broadcast(event);
  return c.json({ ok: true });
});

app.post("/api/simulate/start", (c) => {
  startSimulation();
  return c.json({ ok: true, simulating });
});

app.post("/api/simulate/stop", (c) => {
  stopSimulation();
  return c.json({ ok: true, simulating });
});

app.get("/api/simulate/status", (c) => c.json({ ok: true, simulating }));

if (import.meta.env.PROD) {
  app.get("/assets/*", async (c) => {
    const path = c.req.path.replace(/^\//, "");
    const filePath = new URL(`../dist/static/${path.replace(/^assets\//, "assets/")}`, import.meta.url);
    try {
      const body = await readFile(filePath);
      const type =
        path.endsWith(".css")
          ? "text/css; charset=utf-8"
          : path.endsWith(".js")
            ? "application/javascript; charset=utf-8"
            : "application/octet-stream";
      return new Response(body, { headers: { "content-type": type } });
    } catch {
      return c.notFound();
    }
  });

  const staticFiles: Record<string, string> = {
    "/logo.svg": "logo.svg",
    "/seer.png": "seer.png",
    "/favicon.svg": "favicon.svg",
  };

  for (const [route, fileName] of Object.entries(staticFiles)) {
    app.get(route, async (c) => {
      try {
        const body = await readFile(new URL(`../dist/static/${fileName}`, import.meta.url));
        const type =
          fileName.endsWith(".svg")
            ? "image/svg+xml"
            : fileName.endsWith(".png")
              ? "image/png"
              : "application/octet-stream";
        return new Response(body, { headers: { "content-type": type } });
      } catch {
        return c.notFound();
      }
    });
  }
}

app.get("*", async (c) => {
  const html = await readFile(
    new URL(import.meta.env.PROD ? "./static/index.html" : "../index.html", import.meta.url),
    "utf-8",
  );

  if (import.meta.env.DEV && c.env.vite) {
    const transformed = await c.env.vite.transformIndexHtml(c.req.url, html);
    return c.html(transformed);
  }

  return c.html(html);
});

export default app;
