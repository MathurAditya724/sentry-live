import { Hono } from "hono";
import type { ViteDevServer } from "vite";

const encoder = new TextEncoder();

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 7000);
const UDP_PORT = Number(process.env.UDP_PORT ?? 5556);
const SAMPLE_RATE = Math.max(0, Math.min(1, Number(process.env.SAMPLE_RATE ?? 0.05)));
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS ?? 3000);

type OrbitalState = {
  clients: Map<string, ReadableStreamDefaultController<Uint8Array>>;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  udpStarted: boolean;
};

declare global {
  var __orbitalState: OrbitalState | undefined;
}

const state: OrbitalState =
  globalThis.__orbitalState ?? {
    clients: new Map(),
    heartbeatTimer: null,
    udpStarted: false,
  };

globalThis.__orbitalState = state;

const app = new Hono<{ Bindings: { vite?: ViteDevServer } }>();

const sseFrame = (raw: string) => encoder.encode(`data: ${raw}\n\n`);

const broadcastRaw = (raw: string) => {
  const frame = sseFrame(raw);
  for (const [id, controller] of state.clients.entries()) {
    try {
      controller.enqueue(frame);
    } catch {
      state.clients.delete(id);
    }
  }
};

const startHeartbeat = () => {
  if (state.heartbeatTimer) {
    return;
  }

  state.heartbeatTimer = setInterval(() => {
    broadcastRaw("{}");
  }, HEARTBEAT_MS);
};

const stopHeartbeat = () => {
  if (!state.heartbeatTimer) {
    return;
  }

  clearInterval(state.heartbeatTimer);
  state.heartbeatTimer = null;
};

const startUdpIngest = () => {
  if (state.udpStarted) {
    return;
  }

  state.udpStarted = true;

  Bun.udpSocket({
    hostname: HOST,
    port: UDP_PORT,
    socket: {
      data(_socket: unknown, data: Buffer | Uint8Array) {
        if (Math.random() >= SAMPLE_RATE) {
          return;
        }

        const message = Buffer.from(data).toString("utf-8").trim();
        if (!message) {
          return;
        }

        try {
          const parsed = JSON.parse(message) as unknown;
          if (
            Array.isArray(parsed) &&
            parsed.length === 4 &&
            typeof parsed[0] === "number" &&
            typeof parsed[1] === "number" &&
            typeof parsed[2] === "number" &&
            typeof parsed[3] === "string"
          ) {
            broadcastRaw(message);
          }
        } catch {
          // Ignore malformed UDP payloads.
        }
      },
      error(_socket: unknown, error: Error) {
        console.error("[orbital] UDP ingest error", error);
      },
    },
  });

  console.log(
    `[orbital] UDP ingest listening on ${HOST}:${UDP_PORT} (sampleRate=${SAMPLE_RATE})`,
  );
};

startUdpIngest();

app.get("/healthz", (c) => c.text("ok"));

app.get("/stream", () => {
  const id = crypto.randomUUID();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      state.clients.set(id, controller);
      startHeartbeat();
      controller.enqueue(encoder.encode("retry: 2000\n\n"));
      controller.enqueue(sseFrame("{}"));
    },
    cancel() {
      state.clients.delete(id);
      if (state.clients.size === 0) {
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

if (import.meta.env.PROD) {
  app.get("/assets/*", async (c) => {
    const path = c.req.path.replace(/^\//, "");
    const filePath = new URL(
      `../dist/static/${path.replace(/^assets\//, "assets/")}`,
      import.meta.url,
    );
    try {
      const body = await Bun.file(filePath).arrayBuffer();
      const type = path.endsWith(".css")
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
        const body = await Bun.file(
          new URL(`../dist/static/${fileName}`, import.meta.url),
        ).arrayBuffer();
        const type = fileName.endsWith(".svg")
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
  const html = await Bun.file(
    new URL(
      import.meta.env.PROD ? "./static/index.html" : "../index.html",
      import.meta.url,
    ),
  ).text();

  if (import.meta.env.DEV && c.env.vite) {
    const transformed = await c.env.vite.transformIndexHtml(c.req.url, html);
    return c.html(transformed);
  }

  return c.html(html);
});

if (import.meta.main) {
  Bun.serve({
    hostname: HOST,
    port: PORT,
    fetch: app.fetch,
  });

  console.log(`[orbital] HTTP listening on http://${HOST}:${PORT}`);
}

export default app;
