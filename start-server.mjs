import app from "./dist/index.js";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 7000);

Bun.serve({
  hostname: host,
  port,
  fetch: app.fetch,
});

console.log(`[orbital] HTTP listening on http://${host}:${port}`);
