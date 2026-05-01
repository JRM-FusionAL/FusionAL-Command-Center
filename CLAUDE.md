# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # Production build → /dist
npm run preview    # Preview production build locally
npm run lint       # ESLint on all files
```

Deployment uses Wrangler (Cloudflare Pages/Workers) — `wrangler` is available as a dev dependency.

## Architecture

This is a **single-page React 19 + Vite** monitoring dashboard for the FusionAL microservices platform. There is no backend, no TypeScript, and no test suite.

All application logic lives in two files:
- **`src/App.jsx`** — the entire application (~850+ lines): service health polling, metrics history, event log, chat interface, and all inline CSS-in-JS styles
- **`src/index.css`** — CSS custom properties for the dark theme (cyan/purple palette)

### Service health monitoring

`App.jsx` defines a `SERVICES` array with 5 hardcoded microservices (Gateway on 8089, BI MCP on 8101, API Hub on 8102, Content MCP on 8103, Intelligence MCP on 8104). Health checks poll `https://<subdomain>.fusional.dev/health` every 10 seconds using `AbortSignal.timeout(4000)`. Latency is measured client-side and color-coded (<100 ms green, <300 ms yellow, >300 ms red).

### Metrics and event log

A 30-point rolling history of average latency and online service count feeds a Recharts `LineChart`. Status transitions (online ↔ offline) are appended to an event log with severity levels (error / warning / info / success).

### Christopher-AI chat

The embedded chat panel talks to a local llama.cpp instance at `100.65.9.40:8080` (Tailscale IP of the T3610 host) via POST `/completion`. Timeout is 60 seconds. The endpoint and system prompt are configurable via UI controls rendered inline in the panel.

### Styling

All component styles are written as plain JS objects or template-literal strings inside `App.jsx` — there is no separate CSS module or Tailwind setup. The design uses Space Grotesk for headings and JetBrains Mono for monospace/code elements.
