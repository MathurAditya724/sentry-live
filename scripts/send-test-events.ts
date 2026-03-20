type Config = {
  host: string;
  port: number;
  intervalMs: number;
  count: number | null;
};

export {};

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
];

function parseArgs(argv: string[]): Config {
  const config: Config = {
    host: "127.0.0.1",
    port: 5556,
    intervalMs: 80,
    count: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--host" && next) {
      config.host = next;
      i++;
      continue;
    }
    if (arg === "--port" && next) {
      config.port = Number(next);
      i++;
      continue;
    }
    if (arg === "--interval" && next) {
      config.intervalMs = Number(next);
      i++;
      continue;
    }
    if (arg === "--count" && next) {
      config.count = Number(next);
      i++;
      continue;
    }
  }

  return config;
}

function createEventTuple() {
  const city = cities[Math.floor(Math.random() * cities.length)];
  const lat = city[0] + (Math.random() - 0.5) * 2;
  const lng = city[1] + (Math.random() - 0.5) * 2;
  const platform = platforms[Math.floor(Math.random() * platforms.length)];

  return [Number(lat.toFixed(4)), Number(lng.toFixed(4)), Date.now(), platform] as const;
}

const config = parseArgs(process.argv.slice(2));

if (!Number.isFinite(config.port) || config.port <= 0) {
  throw new Error("Invalid --port value");
}
if (!Number.isFinite(config.intervalMs) || config.intervalMs <= 0) {
  throw new Error("Invalid --interval value");
}
if (config.count !== null && (!Number.isFinite(config.count) || config.count <= 0)) {
  throw new Error("Invalid --count value");
}

const socket = await Bun.udpSocket({
  socket: {
    data() {
      // no-op: sender only
    },
    error(_sock, error) {
      console.error("UDP error:", error);
    },
  },
  hostname: "0.0.0.0",
  port: 0,
});

let sent = 0;

console.log(
  `Sending UDP test events to ${config.host}:${config.port} every ${config.intervalMs}ms${config.count ? ` (${config.count} events)` : ""}`,
);

const timer = setInterval(() => {
  const payload = JSON.stringify(createEventTuple());
  socket.send(payload, config.port, config.host);
  sent++;

  if (sent % 50 === 0) {
    console.log(`sent ${sent} events`);
  }

  if (config.count !== null && sent >= config.count) {
    clearInterval(timer);
    socket.close();
    console.log(`done, sent ${sent} events`);
  }
}, config.intervalMs);

process.on("SIGINT", () => {
  clearInterval(timer);
  socket.close();
  console.log(`\ninterrupted, sent ${sent} events`);
  process.exit(0);
});
