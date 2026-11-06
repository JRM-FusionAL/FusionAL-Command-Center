# FusionAL Command Center

Operations dashboard for the FusionAL MCP gateway: live status, usage charts and management views in one place.

**Stack:** React 19 + Vite, Recharts, Langfuse tracing, deployed on Cloudflare Workers (Wrangler).

## Run locally

```bash
npm install
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm test` | Server tests (`node --test server/*.test.cjs`) |
| `npm run lint` | ESLint |
| `npm run preview` | Build, then run locally under Wrangler |
| `npm run deploy` | Build and deploy to Cloudflare |

## Related

- [FusionAL](https://github.com/JRM-FusionAL/FusionAL) — the MCP gateway this dashboard monitors
- [FusionAL-Recall](https://github.com/JRM-FusionAL/FusionAL-Recall) — solved-issue memory for MCP failure modes

## License

MIT — see [LICENSE](LICENSE).
