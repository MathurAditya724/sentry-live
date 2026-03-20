# Sentry Live Orbital (Vite + React + Hono on Bun)

Orbital-style live globe visualization built with:

- Vite + React + Tailwind frontend
- Hono API integrated with Vite dev server
- Bun runtime for local and production server
- Docker for production deployment

## Requirements

- Bun 1.0+
- Docker (for containerized production)

## Install

```bash
bun install
```

## Development

Single-process development (frontend + API together):

```bash
bun run dev
```

This serves:

- App UI
- API routes under `/api/*`

## API routes

- `GET /api/healthz`
- `GET /api/stream` (SSE)
- `POST /api/events`
- `POST /api/simulate/start`
- `POST /api/simulate/stop`
- `GET /api/simulate/status`

Event payload shape:

```json
{
  "lat": 37.8,
  "lng": -122.4,
  "platform": "javascript",
  "ts": 1760000000000
}
```

## Build

```bash
bun run build
```

Output:

- `dist/index.js` (Bun server)
- `dist/static/*` (frontend assets)

Run built server:

```bash
bun run start
```

Default port: `7000` (override with `PORT`).

## Docker

Build image:

```bash
docker build -t sentry-live-orbital .
```

Run container:

```bash
docker run --rm -p 7000:7000 sentry-live-orbital
```
