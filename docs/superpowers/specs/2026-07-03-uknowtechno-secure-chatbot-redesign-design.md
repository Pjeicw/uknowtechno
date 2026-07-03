# UknowTechno — Secure Chatbot Redesign

**Date:** 2026-07-03
**Status:** Approved design → ready for implementation plan
**Author:** Pjei + Claude

---

## 1. Problem & Goals

The UknowTechno chatbot must be made **secure-first** and re-shaped around a new set of
priorities. The stated priorities, in order:

1. **Security is paramount.** API keys (DeepSeek, OpenAI) and user credentials must *never*
   be reachable by the browser, and must not sit on the Mac Mini or in Cloudflare R2.
2. **DeepSeek is the default** chat model. Ollama is *optional* — selectable only when the
   local notebook (ASUS) is online. **OpenAI requires a password** before it can be used.
3. **Multiple RAG databases** as separate files (`bank.db`, `LAPNet.db`, `portfolio.db`, …),
   stored on the Mac Mini, registered and selectable per chat.
4. **A smart, model-first chatbot** — it answers from the model's own knowledge by default,
   treating the portfolio/RAG as *one optional source*, not the primary one.

### Non-goals (this build)
- Live web-fetch / external browsing for the bot — **deferred to a later phase**.
- Rewriting the backend as a Cloudflare Worker — **rejected**; FastAPI is retained.
- Any storage of retrievable user passwords — passwords stay hashed in PocketBase.

---

## 2. Guiding Security Principle

> Secrets live only where a **server** can reach them. The browser and the Mac Mini never
> hold a provider key.

This is enforced by moving provider keys into **Cloudflare AI Gateway BYOK**, backed by
**Cloudflare Secrets Store**. Research basis (authoritative):

- Cloudflare docs — *"Do not use plaintext environment variables to store sensitive
  information. Use secrets or Secrets Store bindings instead."*
  (https://developers.cloudflare.com/workers/configuration/environment-variables/)
- AI Gateway **BYOK** stores provider keys in Secrets Store; requests reference the key by
  *name*, so the raw value never appears in a request or on the calling host.
  (https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/)
- R2 is object storage — the wrong tool for secrets; it is used here only for portfolio file
  hosting and DB backups.
- User passwords are hashed by PocketBase (bcrypt) and are never stored retrievably anywhere.

---

## 3. Architecture

```
Browser  ──(no secrets, ever)──▶  FastAPI gateway (Mac Mini)
                                    • authenticates visitor / rate-limits
                                    • OpenAI password gate (verified server-side)
                                    • picks provider + model + which RAG DB
                                    • injects role-gated RAG context from local .db files
                                    • holds ONLY the cf-aig gateway token
                                            │
                                            ▼
                              Cloudflare AI Gateway  (BYOK · Secrets Store)
                              • provider keys stored encrypted, referenced by name
                              • spend limits ($/window) · auto-retry · failover · analytics
                                    ├─▶ DeepSeek   ← default
                                    ├─▶ OpenAI     ← only after password unlock
                                    └─▶ Ollama on notebook ← when online
```

**Two-layer gateway distinction (important):**
- **Cloudflare AI Gateway** holds the *provider* keys and enforces spend/retry/failover.
- **FastAPI** is *our* gateway in front of it: it authenticates the visitor, runs the OpenAI
  password gate, chooses model + RAG DB, injects context, and calls AI Gateway with a
  *low-value, spend-limited, rotatable* `cf-aig-authorization` token.

Net effect: the crown-jewel DeepSeek/OpenAI keys leave the Mac Mini entirely.

### Responsibility map
| Component | Holds | Does NOT hold |
|---|---|---|
| Browser | nothing sensitive | no keys, no unlock password |
| FastAPI (Mac Mini) | `cf-aig` gateway token; hashed OpenAI-unlock password | no DeepSeek/OpenAI keys |
| Cloudflare Secrets Store | DeepSeek + OpenAI keys | — |
| PocketBase (Mac Mini) | hashed user/staff logins, config, RAG registry | no provider keys |
| Cloudflare R2 | portfolio assets, DB backups | no secrets |

---

## 4. Components & Changes

### 4.1 AI Gateway integration (backend)
- Point the OpenAI-SDK clients (`deepseek_client`, `openai_client`) at the AI Gateway
  base URL instead of the providers directly.
- Authenticate with the `cf-aig-authorization: Bearer <CF_AIG_TOKEN>` header.
- Reference provider keys by their **Secrets Store name**, never by value.
- New environment variables (all non-secret except `CF_AIG_TOKEN`):
  - `CF_ACCOUNT_ID` — Cloudflare account id
  - `CF_AIG_GATEWAY` — gateway id/slug
  - `CF_AIG_TOKEN` — gateway auth token (the only secret on the Mac Mini)
  - `DEEPSEEK_KEY_REF` — Secrets Store reference name for the DeepSeek key
  - `OPENAI_KEY_REF` — Secrets Store reference name for the OpenAI key
- The legacy `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` env vars are **removed** from the Mac Mini
  once BYOK is verified working.

### 4.2 Default model flip
- Config default `active_model = "deepseek"`.
- Fallback chain default: `deepseek → ollama-local (if online) → openai (if unlocked)`.
- Ollama offline simply drops out of the chain; DeepSeek default is unaffected.

### 4.3 RAG registry + multi-DB
- A registry describing each knowledge base:
  `{ code, label, file, access_level, enabled }`
  (e.g. `bank → rag/bank.db → staff`, `portfolio → rag/portfolio.db → public`).
- Registry storage: a **PocketBase collection** `rag_databases` (matches the requirement that
  RAG lives on the Mac Mini "that uses PocketBase", and admin already authenticates against
  PocketBase). The `.db` files sit on disk beside the backend; PocketBase holds only the
  registry metadata. Editable from the admin panel via the authenticated API.
- `rag_store` functions resolve the correct `.db` file path from the registry for a given
  `kb code`. Retrieval remains role-gated by `access_level`.
- Admin CRUD: add/enable/disable a KB, and per-DB **upload / backfill / purge**.

### 4.4 Chat pickers (frontend)
- **Model dropdown:** DeepSeek (default) · Ollama models (shown *only* when the online probe
  passes) · **OpenAI (locked 🔒)**.
- **Knowledge-base dropdown:** "None (model knowledge)" default, plus role-filtered entries
  from the registry.
- Selecting OpenAI triggers the password flow (4.5) before any OpenAI call is allowed.

### 4.5 OpenAI password gate
- A server-side **hashed** unlock password (stored in env/PocketBase, never plaintext, never
  sent to the browser for comparison).
- `POST /api/unlock-openai { password }` → verify server-side → on success issue a
  **short-lived signed unlock token** (HMAC/JWT, ~15 min TTL).
- Any `/api/chat` request selecting OpenAI must present a valid, unexpired unlock token, else
  `403`. Verification is server-side only.

### 4.6 Model-first system prompt
- Default behavior: answer from the model's own knowledge.
- RAG/portfolio context is injected **only** when a KB is selected or the user explicitly
  asks about Pjei / the portfolio.
- Portfolio is framed as one optional source, not the authority.

---

## 5. Data Flow — one chat request

```
Browser → POST /api/chat { message, model, kb, unlock_token?, smart?, staff_token? }
  → FastAPI:
      1. authenticate + rate-limit
      2. resolve role (staff_token → role → allowed access levels)
      3. if model == openai: require valid unlock_token, else 403
      4. if kb != none: retrieve role-gated context from that registry DB
      5. build messages (model-first prompt + optional context)
      6. call AI Gateway with chosen provider/model + cf-aig auth
      7. stream response back
```

---

## 6. Failover & Spend Control

- **Our fallback chain** + **AI Gateway auto-retry** (configurable, up to 5 attempts).
- DeepSeek down → Ollama (if online) → OpenAI (only if unlocked; otherwise skipped).
- **Spend capped in two places:** AI Gateway dollar-based spend limits (`429` on exceed) and
  the existing per-provider budget gate. A leaked gateway token therefore cannot run up an
  unbounded bill.
- All traffic is logged in AI Gateway analytics for audit.

---

## 7. Error Handling

- OpenAI selected without/with expired unlock token → `403` with a clear "unlock required"
  message the chat UI turns into the password prompt.
- Selected KB missing/disabled → fall back to model-only answer + a non-fatal notice.
- AI Gateway/provider error → retry per policy, then next tier in the fallback chain;
  surface a clean streamed error only if all tiers fail.
- Ollama offline → not offered in the picker; never blocks the default path.

---

## 8. Testing Strategy

**Unit**
- RAG registry resolution (code → correct `.db` file) and role filtering.
- Unlock-token issue / verify / expiry.
- Online-probe model availability (Ollama shown only when up).
- Fallback ordering with DeepSeek as default.

**Integration**
- Real DeepSeek call routed through AI Gateway returns a clean stream.
- OpenAI blocked without unlock; allowed with a valid unlock token.
- Switching KB changes the retrieved context; public visitor cannot reach staff KBs.

---

## 9. Phasing

- **Phase A — Security core:** AI Gateway BYOK wiring, default flip to DeepSeek, migrate keys
  out of Mac Mini env into Secrets Store, remove legacy key env vars.
- **Phase B — Knowledge:** RAG registry + multi-DB resolution + admin CRUD + chat KB picker.
- **Phase C — Access & UX:** OpenAI password gate, model-picker redesign (online-aware,
  OpenAI-locked), model-first system prompt.
- **Later:** external web-fetch/search tool for the bot.

---

## 10. Manual / Ops Steps (owner-only)

These require the user's Cloudflare/PocketBase accounts and machines:

1. Create an **AI Gateway** in the Cloudflare dashboard; enable **Authenticated Gateway**.
2. Add DeepSeek + OpenAI keys via **Provider Keys → Add** (stored in Secrets Store, BYOK).
3. Create a gateway **auth token**; set `CF_AIG_TOKEN` on the Mac Mini only.
4. Configure **spend limits** (e.g. per-day dollar cap) on the gateway.
5. Set `CF_ACCOUNT_ID`, `CF_AIG_GATEWAY`, `DEEPSEEK_KEY_REF`, `OPENAI_KEY_REF` in backend env.
6. Set the **OpenAI unlock password** (hashed) in backend env/PocketBase.
7. Place `bank.db`, `LAPNet.db`, `portfolio.db`, etc. on the Mac Mini and register them.
8. **Rotate** the old DeepSeek/OpenAI keys (the previously-committed plaintext keys are
   compromised) — the rotated keys are the ones added to Secrets Store.
9. Remove `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` from the Mac Mini env after BYOK verified.
```
