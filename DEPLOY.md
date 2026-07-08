# DEPLOY.md — Mac Mini Production Setup (UknowTechno)

> **For Claude Code running on the Mac Mini:** This file is your instruction set.
> The owner (Pjei) is a beginner — execute the commands for them, explain each step
> briefly before running it, and ask before anything destructive. Work top to bottom.
> The repo code is DONE and tested (25 backend tests pass); this is configuration only.

## Architecture recap

```
Browser ──► uknowtechno.com (Cloudflare Pages, static React)
   └──API──► api.uknowtechno.com ──(Cloudflare Tunnel)──► FastAPI on THIS Mac Mini :8000
                                        ├─► DeepSeek/OpenAI via Cloudflare AI Gateway (BYOK)
                                        ├─► Ollama on ASUS notebook (LAN, optional)
                                        └─► PocketBase on THIS Mac Mini :8090
```

## 🔒 Security rules (non-negotiable)

- **NEVER** put raw DeepSeek/OpenAI API keys in `.env`, code, or chat. They live ONLY
  in Cloudflare AI Gateway's stored provider keys (BYOK). The backend references them
  by NAME (`DEEPSEEK_KEY_REF` / `OPENAI_KEY_REF`).
- The only cloud secret on this machine is `CF_AIG_TOKEN` (the AI Gateway auth token).
- Admin auth is PocketBase-only, always. There is no dev-token admin bypass —
  the local-dev-only bypass that briefly existed during development has been
  removed from the codebase entirely (not just disabled).
- Never echo/print `.env` contents into chat output.

## Prerequisites the owner already did (verify, don't redo)

- [ ] Cloudflare account with uknowtechno.com zone active
- [ ] AI Gateway created (note the gateway name, e.g. `uknow-gw`)
- [ ] Rotated DeepSeek + OpenAI keys stored in the gateway as provider keys
      (note their reference names, e.g. `DEEPSEEK_KEY_1`, `OPENAI_KEY_1`)
- [ ] Authenticated Gateway ON + a gateway auth token created (`CF_AIG_TOKEN`)

Ask the owner for: **Account ID**, **gateway name**, **key reference names**, and to
paste the **gateway token** directly into `.env` themselves (or paste it to you ONCE
and immediately write it to `.env`, never repeating it back).

## Step 1 — Install tooling (Homebrew, Python, Node)

```bash
# Check what exists first:
brew --version || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
python3 --version   # need 3.11+  → brew install python@3.12 if missing
node --version      # need 18+    → brew install node if missing
```

## Step 2 — Clone the repo & install backend deps

```bash
cd ~
git clone <REPO_URL> uknowtechno && cd uknowtechno/backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
venv/bin/python -m pytest tests/ -q    # expect: 25 passed
```

## Step 3 — Create backend/.env

Copy the template and fill it in (values from the owner):

```bash
cp .env.example .env
```

Required values:

```ini
# Cloudflare AI Gateway (BYOK)
CF_ACCOUNT_ID=<owner's account id>
CF_AIG_GATEWAY=<gateway name, e.g. uknow-gw>
CF_AIG_TOKEN=<gateway auth token — owner pastes this>
DEEPSEEK_KEY_REF=<stored key name, e.g. DEEPSEEK_KEY_1>
OPENAI_KEY_REF=<stored key name, e.g. OPENAI_KEY_1>

# Ollama on the ASUS notebook (ask owner for its LAN IP; skip if offline)
OLLAMA_API_URL=http://<ASUS_LAN_IP>:11434

# PocketBase (local on this Mac Mini)
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_COLLECTION=_superusers

# CORS — production origin ONLY
CORS_ALLOWED_ORIGINS=https://uknowtechno.com
```

Make sure `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` do NOT appear in `.env`.

## Step 4 — PocketBase (admin auth)

```bash
brew install pocketbase || {
  # or manual: download from https://pocketbase.io/docs/ (macOS arm64), unzip to ~/uknowtechno/pocketbase
  echo "install manually if brew formula unavailable"
}
# Run it once to create the admin account:
pocketbase serve --http 127.0.0.1:8090
```

Have the owner open http://127.0.0.1:8090/_/ and create their REAL admin
(email + strong password). This is what the chat widget's admin login uses.

## Step 5 — Smoke-test the backend locally

```bash
cd ~/uknowtechno/backend
venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
# In another terminal:
curl -s http://127.0.0.1:8000/api/models | head -c 300   # expect JSON with deepseek default
```

Send a test chat via curl; it should stream from DeepSeek THROUGH the gateway:

```bash
curl -N -X POST http://127.0.0.1:8000/api/chat -H "Content-Type: application/json" \
  -d '{"message":"Say hello in one short sentence."}'
```

If it errors, check: gateway token valid? key reference names exactly match the
stored key names in the Cloudflare dashboard? Account ID correct?

## Step 6 — Cloudflare Tunnel → api.uknowtechno.com

Owner does the dashboard part (guide them):
1. **one.dash.cloudflare.com** → Networks → Tunnels → **Create a tunnel** (Cloudflared) → name `uknow-api`.
2. Dashboard shows a **brew/launchctl install command** → run it here on the Mac Mini.
3. Add Public Hostnames in the tunnel config:
   - `api.uknowtechno.com` → `http://localhost:8000`
   - `auth.uknowtechno.com` → `http://localhost:8090`  (PocketBase, for the admin login)
4. DNS records are created automatically.

Verify from outside: `curl -s https://api.uknowtechno.com/api/models | head -c 200`

## Step 7 — Keep everything running (launchd services)

Create LaunchAgents so backend + PocketBase survive reboots. Create
`~/Library/LaunchAgents/com.uknowtechno.backend.plist` and
`com.uknowtechno.pocketbase.plist` (KeepAlive=true, RunAtLoad=true, correct paths),
then `launchctl load` both. cloudflared installs its own service already.
Also: System Settings → Energy → prevent automatic sleeping.

## Step 8 — Frontend deploy (done from ANY machine)

```bash
cd ~/uknowtechno/frontend
npm install
VITE_API_BASE=https://api.uknowtechno.com \
VITE_POCKETBASE_URL=https://auth.uknowtechno.com \
npm run build
npx wrangler pages deploy dist --project-name uknowtechno
```

Then in Cloudflare Pages → project → **Custom domains** → add `uknowtechno.com`.

## Step 9 — Final go-live checklist

- [ ] `https://uknowtechno.com` loads, chat streams a DeepSeek answer
- [ ] Admin login works via the chat AI-settings panel (PocketBase email+password)
- [ ] Dev token rejected: any request with the old `letmein123` fails
- [ ] AI Gateway dashboard shows the requests + set a spend limit ($1–2/day)
- [ ] `backend/.env` contains NO `DEEPSEEK_API_KEY` / `OPENAI_API_KEY`
- [ ] Mac Mini reboot test: everything comes back by itself
