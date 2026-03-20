# Sentry Live Orbital

`sentry-live` is a Bun + Hono + React recreation of the Sentry Orbital experience.

The project focuses on a live, globe-based event stream visualization that feels close to the original Orbital implementation:

- deep-space visual treatment
- pulsing event markers on a rotating globe
- Seer orbiting element
- live event feed and sampled counter

## Project idea

The core idea is to show live error activity as a global signal, not as a static dashboard.

Instead of polling JSON APIs, the app follows the Orbital model:

- UDP event ingest on `5556/udp`
- server-side sampling
- SSE fanout on `/stream`
- browser-side rendering and lightweight UI overlays

This keeps the architecture simple and real-time friendly for a single deployment unit.

## Runtime model

- **HTTP**: `7000/tcp` (UI + stream + health)
- **UDP**: `5556/udp` (event ingest)
- **SSE route**: `GET /stream`
- **Health route**: `GET /healthz`

Environment variables:

- `PORT` (default `7000`)
- `HOST` (default `127.0.0.1`)
- `UDP_PORT` (default `5556`)
- `SAMPLE_RATE` (default `0.05`)
- `HEARTBEAT_MS` (default `3000`)

Incoming UDP payload format:

```json
[37.8, -122.4, 1760000000000, "javascript"]
```

## Local run

```bash
bun install
cp .env.example .env.local
bun run dev
```

Environment config lives in `.env.local` (see `.env.example`).
Bun and Vite both auto-load `.env*` files.

To push test events into UDP ingest:

```bash
bun run test:events
```

Optional test sender flags:

```bash
bun run test:events -- --host 127.0.0.1 --port 5556 --interval 80 --count 500
```

Run production build locally:

```bash
bun run build
bun run start
```

## Docker deployment

```bash
docker build -t sentry-live-orbital .
docker run --rm -p 7000:7000 -p 5556:5556/udp -e HOST=0.0.0.0 sentry-live-orbital
```

## Contributing

See `CONTRIBUTING.md` for setup, workflow, and PR guidance.
