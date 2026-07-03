# UknowTechno — Setup & Configuration Guide

Everything below is the **manual configuration** you need to do. The code is
done and tested; these are the steps only you can run (they touch your machines,
accounts, and secrets).

---

## 0. Prerequisites

| Tool | Why | Install |
|---|---|---|
| Python 3.11+ | FastAPI backend | already have 3.14 |
| Node 18+ | React frontend | already have |
| **Ollama** | local LLM + embeddings + vision | https://ollama.com |
| **PocketBase** | admin auth + (future) config | https://pocketbase.io/docs |

---

## 1. Backend — install & configure

```bash
cd backend
# use the existing venv (already created)
venv/Scripts/python.exe -m pip install -r requirements.txt   # installs new deps

# create your real .env from the template
cp .env.example .env
```

Then edit `backend/.env` and set **at minimum**:

```ini
# Point at wherever Ollama runs (Mac Mini or ASUS). Code accepts either name.
OLLAMA_API_URL=http://127.0.0.1:11434

# PocketBase — the admin panel logs in against this.
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_COLLECTION=_superusers

# Who may call the API from a browser (NO trailing slash, comma-separated).
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://uknowtechno.com

# Cloud keys — paste your NEWLY ROTATED keys here (never commit this file).
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
```

> 🔴 **Rotate your OpenAI + DeepSeek keys first** — the old ones were committed
> in plaintext and must be considered compromised.

Optional tuning (sensible defaults exist for all of these):

```ini
EMBED_MODEL=nomic-embed-text     # embedding model (768-dim)
VISION_MODEL=llava               # image model
WHISPER_MODEL=base               # speech-to-text size (tiny/base/small/medium)
CHAT_RATE_LIMIT=20/minute        # public /api/chat throttle
RAG_MAX_DISTANCE=1.0             # relevance cutoff for retrieved chunks
BACKUP_RETENTION_DAYS=14         # how long R2 backups are kept
```

---

## 2. Pull the Ollama models

```bash
ollama pull nomic-embed-text     # embeddings (required for RAG)
ollama pull llama3.2:3b          # a chat model (any you like)
ollama pull llava                # vision (for image chat)
# Whisper downloads itself on first voice message — no action needed.
```

---

## 3. PocketBase — create the admin login

The admin panel authenticates against PocketBase. Its login uses the
**`_superusers`** collection by default.

```bash
# from wherever you keep the pocketbase binary
./pocketbase serve
```

1. Open the printed URL (e.g. `http://127.0.0.1:8090/_/`).
2. Create your **superuser** (email + password) on first run.
3. Those are the credentials you'll type into the portfolio's `/admin` login.

> If you'd rather use a normal `users` collection instead of superusers, set
> `POCKETBASE_ADMIN_COLLECTION=users` in `backend/.env` **and**
> `VITE_POCKETBASE_COLLECTION=users` in `frontend/.env`.

---

## 4. Frontend — configure & run

```bash
cd frontend
cp .env.example .env          # then edit if your URLs differ
npm install
npm run dev                   # http://localhost:5173
```

`frontend/.env`:
```ini
VITE_API_BASE=http://localhost:8000
VITE_POCKETBASE_URL=http://localhost:8090
VITE_POCKETBASE_COLLECTION=_superusers
```

---

## 5. Run the backend

```bash
cd backend
venv/Scripts/python.exe main.py      # serves on http://localhost:8000
```

Order to start things: **Ollama → PocketBase → backend → frontend.**

---

## 5b. Local-first quick start (no PocketBase yet)

To try everything on your machine before setting up PocketBase:
1. In `backend/.env`, set a dev token, e.g. `ADMIN_DEV_TOKEN=letmein123`.
2. Start the backend, open `/admin`, click **▸ LOCAL DEV ACCESS**, enter `letmein123`.
3. You now have full admin access locally. **Unset `ADMIN_DEV_TOKEN` in production.**

## 6. First-run inside the Admin panel (`/admin`)

1. Log in with your PocketBase superuser email/password (or the dev token above).
2. **AI Models tab → ACTIVE MODEL:** a dropdown lists your **installed Ollama
   models** live. Pick one to always use it, or choose **🤖 Auto** for smart
   use-case routing. The card also shows Ollama online/offline + whether your
   DeepSeek/OpenAI keys are detected. If Ollama is offline, chats auto-fall back
   to DeepSeek → OpenAI (make sure those keys are set).
3. **Knowledge tab** → the 453 seeded chunks are bank-demo content with **no
   vectors**. Two choices:
   - **Keep & embed them:** click **BACKFILL** (repeat until "0 remaining").
   - **Start clean:** click **PURGE**, then **SMART UPLOAD** your own docs
     (PDF/DOCX/XLSX/MD/TXT) — they're chunked + embedded automatically.
3. **AI Models tab** → pick the active model (Ollama / DeepSeek / OpenAI) and set
   monthly USD budgets. Spend bars show real month-to-date usage.

---

## 6b. Model routing & staff roles (G1/G2/G3)

**Use-case routing (admin → AI Models tab → "USE-CASE ROUTING"):** set which
local model handles each intent. Defaults:
| Intent | Model | When |
|---|---|---|
| Coding | `qwen2.5-coder:7b` | code/error/debug questions (auto-detected) |
| General | `llama3.2:3b` | everything else |
| Fast | `deepseek-r1:1.5b` | reserved lightweight tier |

**Lao / smart → OpenAI (G2):** Lao-script messages auto-route to OpenAI (toggle
in the same card). Visitors can also tap the ✨ **smart** button in the chat to
force the advanced model for one message. Both respect the budget cap.

**Staff role-gated knowledge (G3):** by default the chat only returns `public`
knowledge. To let staff see internal content (e.g. the bank SOPs):
1. In PocketBase, open the **`users`** collection → add a **text field `role`**
   with one of: `public`, `staff`, `technical_staff`, `admin`.
2. Create staff accounts and set their `role`.
3. When a staff member is logged in, the frontend sends their token (stored in
   `localStorage` as `staff_token`) and the chat unlocks their level and below.
   (A staff-login screen on the site is a small follow-up; the backend gating is
   done and enforced — public visitors can never retrieve staff content.)

Upload knowledge at the right level: set a document's `access_level` so it's only
visible to that role and above.

---

## 7. Nightly backup (optional but recommended)

```bash
# add R2 creds to backend/.env first (CLOUDFLARE_ACCOUNT_ID, R2 bucket/keys)
venv/Scripts/python.exe backup_to_r2.py
```
Schedule it nightly via cron / Task Scheduler / a Coolify scheduled job. It
takes a safe SQLite snapshot, uploads to R2, and prunes backups older than
`BACKUP_RETENTION_DAYS`.

---

## 8. Production deploy (Phase 4 — pure ops)

This part is all Cloudflare/Coolify dashboard work; see `IMPROVEMENT_PLAN.md` §5
for the full DNS table. Summary:

1. **Portfolio** → Cloudflare Pages at the apex `uknowtechno.com`.
2. **Coolify UI** → `coolify.uknowtechno.com` (tunnel).
3. **API** → `api.uknowtechno.com` (tunnel → Mac Mini: `/_/`→PocketBase,
   `/api/*`→FastAPI).
4. **Deploy the health-router Worker** in front of the API:
   ```bash
   cd cloudflare-worker
   # set ORIGIN_URL in wrangler.toml to your tunnel hostname
   wrangler login && wrangler deploy
   ```
   Add route `api.uknowtechno.com/*` → this Worker in the dashboard.
5. Put PocketBase `/_/` behind **Cloudflare Access**.
6. Set the same env vars from steps 1 & 4 in **Coolify's secret store** (not a
   committed `.env`).

---

## Quick reference — what each new file does

| File | Purpose |
|---|---|
| `backend/rag_store.py` | sqlite-vec vector store + config/usage helpers |
| `backend/main.py` | gateway: auth, RAG, budget, failover chain, multi-modal |
| `backend/backup_to_r2.py` | safe snapshot + R2 backup with retention |
| `cloudflare-worker/` | edge health-router for whole-server failover |
| `frontend/.env.example` | frontend config template |
