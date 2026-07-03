# UknowTechno — Requirements Re-check (2 Jul 2026)

Re-validating your stated goals against what's actually built. Legend:
✅ done & tested · ⚠️ partial (works, but not the full intent) · ❌ gap · 📋 ops-only (no code) · ❓ needs a decision.

---

## 1. Coverage matrix

| # | Your requirement | Status | Reality in the code |
|---|---|---|---|
| 1 | `uknowtechno.com` → portfolio; `coolify.` → Coolify; `api.…/_/` → PocketBase | 📋 Ops | Fully documented in `SETUP.md §8`. DNS/tunnel work only — no code needed. |
| 2 | Portfolio has a chatbot | ✅ | `ChatWidget` on the site, streaming, threads, i18n. |
| 3 | Local models **qwen2.5-coder:7b, llama3.2:3b, deepseek-r1:1.5b** | ⚠️ | Backend talks to Ollama, but picks the **first installed model** automatically. It can't yet pick *which* local model, nor route coding→qwen / general→llama. |
| 4 | DeepSeek failover when the local box is down | ✅ | `build_fallback_chain` → Ollama → DeepSeek → OpenAI, budget-aware, tested. |
| 5 | OpenAI for "smart" or **Lao** cases | ⚠️ | OpenAI is a tier in the chain, but nothing auto-detects Lao or a "smart" request to route there. Manual only. |
| 6 | Configure models in the admin page | ⚠️ | Admin sets active tier + budgets + can save config. Can't yet choose the local model or per-use-case rules. |
| 7 | RAG database with CRUD | ✅ | list / upload(chunk→embed→store) / delete / backfill / purge, all admin-gated. |
| 8 | **Deploy the chatbot for staff** | ❌ | RAG returns **all** chunks to **everyone**. `access_level` (public/staff/technical_staff/admin) exists in the schema but isn't enforced. No staff-vs-public separation in chat. |
| 9 | Secure DeepSeek/OpenAI keys (anti-hacking) | ✅ | Keys live server-side only; FastAPI is the gateway. Admin auth (PocketBase), CORS pinned, rate-limited, budget-capped. |
| 10 | Dynamic auto-switch on error | ✅ | 3 layers: model (chain), node (local→cloud), whole-server (Cloudflare Worker). |
| 11 | Cloudflare R2 as "database or hosting" | ❓ | **Clarification below** — R2 is object storage, not a database. |
| 12 | One domain hosts other projects (Play policy pages, restaurant site…) to save money | 📋 Ops | Free via Cloudflare Pages subdomains. Plan in `IMPROVEMENT_PLAN.md §5`. |
| 13 | Save money / no revenue yet | ✅ by design | Local-first routing, hard budget caps, everything on free tiers. |

**Score:** 8 ✅, 4 ⚠️/❌ that are genuine feature gaps (#3, #5, #6, #8), plus ops + one clarification.

---

## 2. Things to clarify

### R2 is not a database
Cloudflare R2 = **object storage** (files/blobs, S3-compatible). It's perfect for:
- **Backups** (already wired: `backup_to_r2.py`).
- **Static hosting assets** (images, downloads).

It is **not** where your live app data lives. Your actual databases are:
- **PocketBase** (SQLite) — auth, users/roles, app config.
- **`rag.db`** (SQLite + sqlite-vec) — knowledge chunks + vectors.

So the accurate picture is: **PocketBase + rag.db = databases; R2 = backup/asset storage; Cloudflare Pages = static hosting; Mac Mini/notebook = compute.**

### Node topology (affects failover wiring)
You mentioned a **notebook** that can shut down *and* a **Mac Mini** as a backup server. To wire failover correctly I need to know which box runs Ollama primarily, so `OLLAMA_API_URL` and the failover order point at the right place.

### The bank content in rag.db is probably intentional
`rag.db` holds bank-support knowledge (SOPs, LAPNet/LMPS) and a roles system
(public/staff/technical_staff/admin). Given requirement #8 ("deploy for staff"),
this looks like **real staff knowledge**, not junk. So — reversing my earlier
note — you likely want to **keep and embed it**, gated by role, not purge it.

---

## 3. The real feature gaps (proposed build)

### G1 — Local model selection + use-case routing  (req #3, #6)
Store a per-role/per-use-case model map in config and let admin edit it:
- coding intent → `qwen2.5-coder:7b`
- general chat → `llama3.2:3b`
- fast/cheap → `deepseek-r1:1.5b`
- "smart" or **Lao** → OpenAI (budget permitting)

Add lightweight intent detection (keywords for code; Unicode range for Lao) with an admin override, all feeding the existing failover chain.

### G2 — Lao / "smart" auto-routing  (req #5)
Detect Lao script (Unicode block U+0E80–U+0EFF) or a "smart mode" flag → prefer OpenAI. Falls back through the chain if over budget.

### G3 — Role-based knowledge for staff  (req #8)
- Public visitors → only `public` chunks (portfolio/website KB).
- Staff (logged in via PocketBase) → their `access_level` and below.
- Enforce by adding an `access_level` filter to `rag_store.search`, and pass the caller's role from their PocketBase token.

### Ops (guided, not code): domain + multi-project
Per `SETUP.md §8` and `IMPROVEMENT_PLAN.md §5` — DNS map, the Worker, and free Cloudflare Pages projects for `policy.` / `restaurant.` subdomains.

---

## 4. Suggested order
1. **G1 + G2** (model routing) — highest-value, matches "config in admin page".
2. **G3** (staff roles) — unlocks the staff-deployment goal.
3. **Ops** — domain switch + multi-project (you run these; I guide).

---

## 5. BUILD STATUS (updated 2 Jul 2026) — G1/G2/G3 DONE ✅

- **G1 — use-case routing:** ✅ coding→qwen2.5-coder:7b, general→llama3.2:3b,
  admin-editable map (AI Models tab). Tested (coding→qwen, general→llama).
- **G2 — Lao / smart → OpenAI:** ✅ auto Lao-script detection + a ✨ smart toggle
  in the chat, budget-aware. Tested (Lao→gpt-4o-mini, smart flag→gpt-4o-mini).
- **G3 — role-gated knowledge:** ✅ `access_level` now enforced in retrieval;
  public visitors cannot read staff content; staff role resolved from a
  PocketBase token. Tested (public blocked from staff chunk, staff allowed).

Only **ops** remain (domain switch, multi-project subdomains) — see `SETUP.md`.
Staff-login *screen* on the public site is an optional small follow-up; backend
gating is complete and enforced.
