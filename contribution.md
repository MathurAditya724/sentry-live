# Contribution Guide

Thanks for helping improve this project.

## Local setup

1. Install dependencies:

```bash
bun install
```

2. Start development server:

```bash
bun run dev
```

3. Optional: stream test events to UDP ingest:

```bash
bun run test:events
```

## Development workflow

- Keep API compatibility with the Orbital style routes:
  - `GET /healthz`
  - `GET /stream`
- Keep UDP ingest payload format as:
  - `[lat,lng,ts,"platform"]`
- Prefer small, focused pull requests.
- Follow existing TypeScript and linting style.

## Checks before opening a PR

Run:

```bash
bun run lint
bun run build
```

## Commit style

- Use concise, descriptive commit messages.
- Explain the intent in the body when changes are not obvious.

## Reporting issues

When filing bugs, include:

- What you expected
- What happened
- Steps to reproduce
- Screenshots/logs if relevant
