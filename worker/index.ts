import { Hono } from "hono";

type OrbitalEvent = {
  lat: number;
  lng: number;
  ts: number;
  platform: string;
};

type Env = {
  ORBITAL_HUB: DurableObjectNamespace;
};

type DurableObjectNamespace = {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
};

type DurableObjectId = { toString(): string };

type DurableObjectStub = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type DurableObjectStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  deleteAlarm(): Promise<void>;
};

type DurableObjectState = {
  storage: DurableObjectStorage;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
};

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

const hubUrl = "https://orbital-hub.internal";

function createEvent(): OrbitalEvent {
  const city = cities[Math.floor(Math.random() * cities.length)];
  const lat = city[0] + (Math.random() - 0.5) * 2;
  const lng = city[1] + (Math.random() - 0.5) * 2;

  return {
    lat,
    lng,
    ts: Date.now(),
    platform: platforms[Math.floor(Math.random() * platforms.length)],
  };
}

function jsonSse(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function normalizeEvent(input: unknown): OrbitalEvent | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Partial<OrbitalEvent>;
  if (
    typeof candidate.lat !== "number" ||
    typeof candidate.lng !== "number" ||
    typeof candidate.platform !== "string"
  ) {
    return null;
  }

  return {
    lat: candidate.lat,
    lng: candidate.lng,
    platform: candidate.platform,
    ts: typeof candidate.ts === "number" ? candidate.ts : Date.now(),
  };
}

export class OrbitalHub {
  private readonly state: DurableObjectState;
  private clients = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private simulating = false;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      this.simulating = (await this.state.storage.get<boolean>("simulating")) ?? false;
      if (this.simulating) {
        await this.state.storage.setAlarm(Date.now() + 80);
      }
    });
  }

  private startHeartbeat() {
    if (this.heartbeat !== null) {
      return;
    }

    this.heartbeat = setInterval(() => {
      this.broadcast({ heartbeat: true, ts: Date.now() });
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeat === null) {
      return;
    }

    clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private broadcast(payload: unknown) {
    const frame = jsonSse(payload);

    for (const [id, controller] of this.clients.entries()) {
      try {
        controller.enqueue(frame);
      } catch {
        this.clients.delete(id);
      }
    }

    if (this.clients.size === 0) {
      this.stopHeartbeat();
    }
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/stream") {
      const id = crypto.randomUUID();
      const stream = new ReadableStream<Uint8Array>({
        start: (controller) => {
          this.clients.set(id, controller);
          this.startHeartbeat();
          controller.enqueue(new TextEncoder().encode("retry: 2000\n\n"));
          controller.enqueue(jsonSse({ connected: true, ts: Date.now() }));
        },
        cancel: () => {
          this.clients.delete(id);
          if (this.clients.size === 0) {
            this.stopHeartbeat();
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
    }

    if (pathname === "/publish" && request.method === "POST") {
      const event = normalizeEvent(await request.json());
      if (!event) {
        return Response.json({ ok: false, error: "invalid payload" }, { status: 400 });
      }
      this.broadcast(event);
      return Response.json({ ok: true });
    }

    if (pathname === "/simulate/start" && request.method === "POST") {
      this.simulating = true;
      await this.state.storage.put("simulating", true);
      await this.state.storage.setAlarm(Date.now() + 80);
      return Response.json({ ok: true, simulating: true });
    }

    if (pathname === "/simulate/stop" && request.method === "POST") {
      this.simulating = false;
      await this.state.storage.put("simulating", false);
      await this.state.storage.deleteAlarm();
      return Response.json({ ok: true, simulating: false });
    }

    if (pathname === "/simulate/status") {
      return Response.json({ ok: true, simulating: this.simulating });
    }

    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    if (!this.simulating) {
      return;
    }

    this.broadcast(createEvent());
    await this.state.storage.setAlarm(Date.now() + 80);
  }
}

const app = new Hono<{ Bindings: Env }>();

function getHub(c: { env: Env }) {
  const id = c.env.ORBITAL_HUB.idFromName("global");
  return c.env.ORBITAL_HUB.get(id);
}

app.get("/api/healthz", (c) => c.json({ ok: true, ts: Date.now() }));

app.get("/api/stream", async (c) => {
  const response = await getHub(c).fetch(`${hubUrl}/stream`);
  return response;
});

app.post("/api/events", async (c) => {
  const event = normalizeEvent(await c.req.json());
  if (!event) {
    return c.json({ ok: false, error: "invalid payload" }, 400);
  }

  await getHub(c).fetch(`${hubUrl}/publish`, {
    method: "POST",
    body: JSON.stringify(event),
    headers: { "content-type": "application/json" },
  });

  return c.json({ ok: true });
});

app.post("/api/simulate/start", async (c) => {
  const response = await getHub(c).fetch(`${hubUrl}/simulate/start`, { method: "POST" });
  return response;
});

app.post("/api/simulate/stop", async (c) => {
  const response = await getHub(c).fetch(`${hubUrl}/simulate/stop`, { method: "POST" });
  return response;
});

app.get("/api/simulate/status", async (c) => {
  const response = await getHub(c).fetch(`${hubUrl}/simulate/status`);
  return response;
});

export default app;
