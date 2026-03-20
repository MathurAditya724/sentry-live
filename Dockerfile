FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7000
ENV HOST=0.0.0.0
ENV UDP_PORT=5556
ENV SAMPLE_RATE=0.05

COPY --from=builder /app/dist ./dist

EXPOSE 7000
EXPOSE 5556/udp

CMD ["bun", "run", "start"]
