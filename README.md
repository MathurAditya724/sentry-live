# Sentry Live Orbital (Vite + React + Hono + Cloudflare Workers)

This project recreates the live orbital visualization style with:

- Vite + React frontend
- `cobe` for the globe rendering
- Hono API on Cloudflare Workers
- Durable Object fanout for SSE streaming
- built-in simulated event generator
- default upstream SSE stream from Sentry Orbital (`https://sentry.live/stream`)

## Requirements

- Bun 1.0+
- Cloudflare account + Wrangler auth for deploy

## Install

```bash
bun install
```

## Local development

Run both the Worker API and Vite frontend together:

```bash
bun run dev:all
```

This starts:

- Vite on `http://localhost:5173`
- Worker on `http://127.0.0.1:8787`

Vite proxies `/api/*` to the Worker.

By default the frontend connects directly to the Orbital-style SSE endpoint:

- `https://sentry.live/stream`

If that external stream is unavailable, the app falls back to local Worker stream (`/api/stream`).

## API routes

- `GET /api/healthz`
- `GET /api/stream` (SSE)
- `POST /api/events`
- `POST /api/simulate/start`
- `POST /api/simulate/stop`
- `GET /api/simulate/status`

## Changing upstream stream URL

Set this env var for frontend if you want a different upstream SSE source:

```bash
VITE_SENTRY_ORBITAL_STREAM_URL=https://your-stream.example.com/stream
```

Event payload shape:

```json
{
  "lat": 37.8,
  "lng": -122.4,
  "platform": "javascript",
  "ts": 1760000000000
}
```

## Build and checks

```bash
bun run lint
bun run build
```

## Deploy

```bash
bun run deploy
```

Durable Object binding is configured in `wrangler.jsonc` with class `OrbitalHub`.
