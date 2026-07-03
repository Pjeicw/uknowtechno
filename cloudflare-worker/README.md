# UknowTechno API Health-Router (Cloudflare Worker)

Phase 3, Layer C failover. Fronts `api.uknowtechno.com` and proxies to the
Mac Mini origin. When the origin is unreachable (power/internet/tunnel down),
it returns graceful "offline" responses so the site keeps working:

| Endpoint | Origin down behaviour |
|---|---|
| `GET /api/config` | `200 {"status":"offline","model":"Offline"}` → widget shows offline dot |
| `POST /api/chat` | One-shot SSE "offline for maintenance" message, then `[DONE]` |
| anything else | `503 {"status":"offline"}` |

This pairs with the frontend changes in `ChatWidget.tsx`, which already treat
an offline `/api/config` and a fetch timeout as offline mode.

## Deploy

```bash
npm install -g wrangler        # if not installed
cd cloudflare-worker
wrangler login
# set ORIGIN_URL in wrangler.toml to your tunnel hostname first
wrangler deploy
```

Then in the Cloudflare dashboard add a route mapping
`api.uknowtechno.com/*` to this Worker (or uncomment `routes` in `wrangler.toml`).

## How it fits the architecture

- **Frontend** (Cloudflare Pages) stays online globally regardless of home power.
- **This Worker** decides, per request, whether the origin is alive.
- **Origin** (Mac Mini via Tunnel) serves the real FastAPI + PocketBase.

Tune `ORIGIN_TIMEOUT_MS` in `worker.js` for how long to wait before declaring
the origin down.
