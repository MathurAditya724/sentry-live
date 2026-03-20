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

COPY --from=builder /app/dist ./dist

EXPOSE 7000

CMD ["bun", "run", "start"]
