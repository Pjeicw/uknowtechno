# UknowTechno — Project Review & Improvement Plan

_Reviewed: 1 July 2026 — covers `architecture.txt`, `prompt.md`, `backend/main.py`, `backend/backup_to_r2.py`, `.env`, and the React frontend._

---

## 0. TL;DR

Your architecture direction is excellent and cheap: Cloudflare edge (free) + Coolify + PocketBase + hybrid local/cloud AI, all on hardware you already own. The **design doc is ahead of the code**, though — several protections described in `architecture.txt` are not actually implemented in `main.py`. Fix the security holes first, then wire up the RAG + budget logic that the docs already promise, then add the subdomain/failover layer.

**Do these 3 things today (before anything else):**

1. **Rotate your OpenAI + DeepSeek API keys.** They are in plaintext in `backend/.env` and there is no `.gitignore` protecting them. Assume they are compromised.
2. **Add a `.gitignore`** so `.env`, `venv`, `node_modules`, `rag.db`, and `pb_data` never get committed.
3. **Attach auth to `/api/admin/upload`** — right now it has *no* authentication and anyone could push files into your RAG.

---

## 1. Security review (most important)

| # | Severity | Issue | Where | Fix |
|---|----------|-------|-------|-----|
| S1 | 🔴 Critical | Live API keys in plaintext, no `.gitignore` | `backend/.env` | Rotate keys, add `.gitignore`, move secrets to Coolify's env/secret store |
| S2 | 🔴 Critical | `/api/admin/upload` has **no** `Depends(verify_...)` — fully open | `main.py:81` | Add the admin dependency to every `/api/admin/*` route |
| S3 | 🔴 Critical | Admin auth is fake: hardcoded `Bearer valid_admin_token` | `main.py:50-56` | Verify the token against PocketBase (`/api/collections/users/auth-refresh`) |
| S4 | 🟠 High | `CORS allow_origins=["*"]` **with** `allow_credentials=True` — invalid + insecure combo | `main.py:21-27` | Pin origins to `https://uknowtechno.com` (browsers reject `*`+credentials anyway) |
| S5 | 🟠 High | No rate limiting on public `/api/chat` — a visitor can drain your paid tokens or DDoS Ollama | `main.py:107` | Add IP rate limit (SlowAPI) + Cloudflare WAF rate rule; keep default model = local |
| S6 | 🟡 Med | Token **budget check is documented but not in code** — nothing stops cloud spend | `architecture.txt:44-54` vs `main.py` | Implement `verify_token_budget()` in the chat path + record real `response.usage` cost to PocketBase |
| S7 | 🟡 Med | `APP_STATE` is an in-memory mock — resets on restart, not shared across workers | `main.py:35-40` | Persist config in PocketBase; cache in memory with short TTL |
| S8 | 🟡 Med | Admin panel served at `/admin` on the public app | `App.tsx:342` | Fine to keep, but protect with PocketBase auth + consider moving to a non-guessable path or Cloudflare Access |

### The "secure the API keys" pattern you want
Your instinct — _"secure API deepseek and openai to save in database or api gateway"_ — is right. The correct pattern for a self-host budget setup:

- **Keys never touch the browser.** ✅ Your design already does this (all vendor calls happen in FastAPI). Keep it that way.
- **Keys live in Coolify's secret store**, injected as env vars at runtime — *not* in a committed `.env`.
- **Don't store raw keys in PocketBase.** PocketBase should store *config and budgets* (active model, monthly limit, current spend), not the secret keys themselves. The keys stay in the server environment. This gives you the "API gateway" behavior (rotate/budget/observe centrally) without the risk of a DB dump leaking your keys.
- **Add a gateway layer** (your FastAPI *is* the gateway): rate limit → auth check → budget check → route → record usage. That's the whole "hardening against hacking" story for a solo/small-team setup.

---

## 2. Feature gaps: docs vs. actual code

`prompt.md` lists 7 tasks. Here's the honest status in the current `main.py`:

| Task (from prompt.md) | Status in code | Note |
|---|---|---|
| Frontend migration to React/Vite | ✅ Done | App.tsx, components, i18n context all present |
| PocketBase auth middleware | ⚠️ Stub only | Hardcoded token; not talking to PocketBase |
| `GET/PUT /api/config` | ⚠️ Partial | Works on in-memory mock, not PocketBase |
| Multi-modal upload (PDF/DOCX/XLSX/MD) | ⚠️ Extract only | Text is extracted but **never chunked, embedded, or stored in Qdrant** |
| Chunking + embeddings + vector store | ❌ Missing | No embedding call, no Qdrant write |
| RAG retrieval injected into chat | ❌ Missing | `/api/chat` never queries the vector DB |
| Image + audio (vision/Whisper) | ❌ Missing | `/api/chat` reads JSON only, not FormData; no image/audio path |
| Model router + budget check | ⚠️ Partial | Ollama→DeepSeek fallback exists; **no budget gate, no OpenAI fallback tier** |
| Usage/cost accounting | ❌ Missing | `response.usage` is never read |
| SSE streaming | ✅ Done | Solid streaming + error handling |
| Backup to R2 | ✅ Works | But no retention/rotation; hot-copies SQLite (corruption risk) — see §4 |

**Bottom line:** the chat + fallback + streaming core is working; the RAG pipeline and budget enforcement are essentially TODOs despite being described as done in `architecture.txt`.

---

## 3. Dynamic auto-switch / failover (your "auto switch if error" requirement)

You want the system to gracefully self-heal. Design it as **three independent failover layers**, because different things fail differently:

**Layer A — Model failover (inside FastAPI).** Already partly built.
```
local Ollama (default)  →  DeepSeek (cheap cloud)  →  OpenAI (smart / Lao)
```
- Health-probe Ollama with a short timeout (you do this ✅).
- Extend the chain: if DeepSeek errors *and* budget allows, try OpenAI; if budget is exhausted, degrade to a polite "AI busy" message rather than spending.
- Make the chain **config-driven** in PocketBase (an ordered `fallback_chain` list) so you change priority from the admin page with no redeploy — this matches your "config it in admin page" goal.

**Layer B — Node failover (ASUS vs Mac Mini).** Your Ollama runs on the ASUS workstation (`OLLAMA_HOST=asus_ip`), the stack runs on the Mac Mini. If the ASUS is off, Layer A already routes to cloud. Good. If you later run Ollama on *both*, list both hosts and round-robin/health-check them.

**Layer C — Whole-server failover (Cloudflare Worker).** If the Mac Mini loses power/internet, the tunnel drops and the whole API is gone. This is where your "Cloudflare Worker smart reverse-proxy" idea earns its keep:
- Frontend is on Cloudflare Pages, so **the portfolio stays online globally** regardless.
- A tiny Worker in front of `api.uknowtechno.com` does a health check; if the origin is down, it returns a JSON `{status:"offline"}` so the chat widget shows _"AI engine offline for maintenance"_ and the rest of the site works untouched.
- The frontend must treat any `fetch` timeout/error on `/api/chat` as "offline mode" (graceful, not a crash). Your `ErrorBoundary` handles React crashes but the **chat fetch needs its own try/catch + timeout** to trigger offline UI.

> Design rule: **the portfolio must never depend on the AI backend being up.** Static content on the edge, AI as a progressive enhancement. This is what makes the "save money / survive outages" goal actually work.

---

## 4. Backup / disaster recovery review

`backup_to_r2.py` works but has three real risks:

1. **Hot-copying `pb_data/data.db` while PocketBase is running can capture a half-written SQLite file** → corrupt restore. Fix: use PocketBase's built-in backup API (`POST /api/backups`) which snapshots safely, *or* run `sqlite3 data.db ".backup"` before zipping. For near-zero-loss, consider **Litestream** streaming SQLite to R2 continuously (free, tiny).
2. **No retention/rotation** — every nightly zip piles up in R2 forever and grows your bill. Fix: set an **R2 lifecycle rule** to auto-delete objects older than N days (e.g., keep 14 daily + 3 monthly), or delete old keys in the script.
3. **Relative paths (`./pb_data`)** depend on the working directory the cron job runs from. Use absolute paths or resolve relative to the script location.

Minor: add a success/failure notification (email or a ping to a Cloudflare Worker) so a silently-failing backup doesn't go unnoticed for weeks.

---

## 5. Domain & subdomain plan (portfolio + Coolify + PocketBase + future projects)

This is the part that lets you **host many projects for ~$0** (only the domain + electricity + gated AI spend). Everything below lives under your one domain on Cloudflare's free tier.

### Recommended DNS / routing map

| Hostname | Serves | Hosted on | Cost |
|---|---|---|---|
| `uknowtechno.com` | **Portfolio** (was Coolify login) | Cloudflare Pages | Free |
| `www.uknowtechno.com` | Redirect → apex | Cloudflare redirect rule | Free |
| `coolify.uknowtechno.com` | Coolify dashboard login | Cloudflare Tunnel → Mac Mini:8000 | Free |
| `api.uknowtechno.com` | FastAPI gateway (`/api/*`) + PocketBase admin (`/_/`) | Cloudflare Tunnel → Mac Mini | Free |
| `policy.uknowtechno.com` | Play Store **privacy policy** pages for your apps | Cloudflare Pages (static) | Free |
| `restaurant.uknowtechno.com` | Restaurant app marketing site | Cloudflare Pages (static) | Free |
| _(add more)_ `app2.uknowtechno.com`… | Any future static site/landing | Cloudflare Pages | Free |

### How to flip the current setup (Coolify → portfolio at the apex)
1. In **Coolify**, change its own accessible URL/domain to `coolify.uknowtechno.com` (Coolify Settings → Instance domain), and update the Cloudflare Tunnel ingress rule to map that hostname to the Coolify UI port.
2. Point `uknowtechno.com` (apex) at your **Cloudflare Pages** portfolio project (add it as a custom domain in Pages).
3. Add a tunnel ingress rule: `api.uknowtechno.com` → your Mac Mini reverse proxy, which forwards `/_/` and `/api/collections/*` to PocketBase:8090 and `/api/*` to FastAPI:8000.
4. Keep the PocketBase Superuser UI (`/_/`) behind **Cloudflare Access** (free for a few users) so the admin panel isn't just password-on-the-internet.

### Cheapest way to add the "other projects" you mentioned
- **Privacy policy pages for Google Play**: Play only requires a stable public URL with the policy text. A single static HTML page per app on `policy.uknowtechno.com/<appname>` is enough — zero backend, zero cost. (You can even keep them all in one small Pages repo.)
- **Restaurant app website / other landing sites**: each is a separate Cloudflare Pages project with its own subdomain. Pages gives you effectively unlimited projects/bandwidth on the free plan.
- **One monorepo vs many repos**: for a solo dev with no revenue yet, a single Git repo with folders (`/portfolio`, `/policy`, `/restaurant`) each deployed as its own Pages project is simplest and free. Split later if a project grows.

> Net effect: your only recurring costs are the **domain renewal** and **electricity**, plus whatever you *choose* to spend on OpenAI/DeepSeek — and that's capped by the budget gate. R2 free tier (10 GB storage, no egress fees) covers backups for a long time.

---

## 6. Cost & footprint notes (Mac Mini friendly)

- **Qdrant** is great but RAM-hungry for a tiny personal RAG. If the Mac Mini feels tight, `sqlite-vec` (you already have `rag.db`) or ChromaDB use far less memory. Keep Qdrant only if you expect large document volumes. Either way, **pin ports internal-only** (don't expose 6333/8090 publicly — go through the tunnel).
- **Ollama models**: you listed `qwen2.5-coder:7b`, `llama3.2:3b`, `deepseek-r1:1.5b`. On a Mac Mini, the 3B/1.5B models are your safe defaults for responsiveness; reserve the 7B for coding queries. Make the default model per-route configurable in the admin page (you already want this).
- **DeepSeek vs OpenAI**: keep DeepSeek as the cheap cloud fallback, OpenAI only for "smart" or Lao-language cases (as you said) — and only when budget remains. Record cost per call so the admin page shows real spend.

---

## 7. Prioritized action plan

### Phase 0 — Stop the bleeding (today, ~1 hr)
- [ ] Rotate OpenAI + DeepSeek keys.
- [ ] Add root `.gitignore` (`.env`, `venv/`, `node_modules/`, `pb_data/`, `qdrant_storage/`, `rag.db`, `*.zip`).
- [ ] Move keys into Coolify secrets; keep `.env.example` (placeholders only) in git.

### Phase 1 — Close security holes (this week)
- [ ] Real PocketBase token verification in `verify_pocketbase_admin`.
- [ ] Attach `Depends(verify_pocketbase_admin)` to **all** `/api/admin/*` routes.
- [ ] Fix CORS to pin `https://uknowtechno.com`.
- [ ] Add SlowAPI rate limiting to `/api/chat` + a Cloudflare WAF rate rule.

### Phase 2 — Make the docs true (RAG + budget)
- [ ] Finish upload pipeline: chunk → embed → store in vector DB; add list/delete CRUD.
- [ ] Query vector DB in `/api/chat` and inject context when RAG is enabled.
- [ ] Implement `verify_token_budget()` + record real `response.usage` cost to PocketBase.
- [ ] Move `APP_STATE` into PocketBase (config, budget, spend, `fallback_chain`).

### Phase 3 — Failover + resilience
- [ ] Extend model fallback chain (Ollama → DeepSeek → OpenAI), config-driven.
- [ ] Add chat-fetch timeout + offline-mode UI in `ChatWidget`.
- [ ] Deploy the Cloudflare Worker health-router in front of `api.uknowtechno.com`.
- [ ] Harden backup: PocketBase backup API (or sqlite `.backup`), R2 lifecycle retention, absolute paths, failure alert.

### Phase 4 — Domain restructure + multi-project
- [ ] Move Coolify UI to `coolify.uknowtechno.com`; portfolio to apex via Pages.
- [ ] Route `api.uknowtechno.com` (`/_/` → PocketBase, `/api/*` → FastAPI) via tunnel.
- [ ] Put PocketBase `/_/` behind Cloudflare Access.
- [ ] Stand up `policy.uknowtechno.com` (Play Store policies) + `restaurant.uknowtechno.com` as free Pages projects.

### Phase 5 — Multi-modal (optional, later)
- [ ] Parse FormData in `/api/chat`; add image (vision) + audio (Whisper) paths.

---

## 8. Open questions for you

1. Where does **Ollama** actually run — the Mac Mini, the ASUS workstation, or both? (Your `.env` says `127.0.0.1` but `.env.example` says the ASUS IP — this changes the failover wiring.)
2. Is this folder already a **Git repo / pushed anywhere**? (Determines how urgent the key rotation + history scrub is.)
3. **Qdrant or `rag.db` (sqlite-vec)** for the vector store? (You have `rag.db` present — were you already mid-migration to a lighter store?)
4. Do you want me to **start implementing Phase 0 + Phase 1** now (I can write the `.gitignore`, fix CORS, wire real admin auth, and add rate limiting directly into your files), or do you want to review this plan first?
