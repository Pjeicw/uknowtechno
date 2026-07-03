# UknowTechno Secure Chatbot — Phase A (Security Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all cloud LLM calls through Cloudflare AI Gateway using BYOK stored keys, remove the provider keys from the backend host, and make DeepSeek the default model.

**Architecture:** The FastAPI backend keeps calling the OpenAI SDK, but the DeepSeek and OpenAI clients now point at the AI Gateway's provider endpoints instead of the vendors directly. Two headers do the work: `cf-aig-authorization: Bearer <CF_AIG_TOKEN>` authenticates the request to the gateway, and the SDK's `api_key` carries a Cloudflare Secrets Store *reference name* (`DEEPSEEK_KEY_REF` / `OPENAI_KEY_REF`) that the gateway swaps for the real, stored provider key. The raw DeepSeek/OpenAI keys never sit on the Mac Mini again.

**Tech Stack:** Python 3.11+, FastAPI, `openai==1.12.0` (AsyncOpenAI), SQLite (`rag_store`), pytest. Cloudflare AI Gateway + Secrets Store (owner-configured, out of code).

## Global Constraints

- Security is the top priority. Provider keys (DeepSeek, OpenAI) must never reach the browser, the Mac Mini host env, or Cloudflare R2 — only Cloudflare Secrets Store, referenced by name.
- The only cloud secret allowed in the backend env is `CF_AIG_TOKEN` (a low-value, spend-limited, rotatable gateway token).
- New backend env vars: `CF_ACCOUNT_ID`, `CF_AIG_GATEWAY`, `CF_AIG_TOKEN`, `DEEPSEEK_KEY_REF`, `OPENAI_KEY_REF`.
- Legacy env vars `DEEPSEEK_API_KEY` and `OPENAI_API_KEY` must be removed from code and from the env blueprint.
- AI Gateway provider base URL format: `https://gateway.ai.cloudflare.com/v1/{CF_ACCOUNT_ID}/{CF_AIG_GATEWAY}/{provider}` where `provider` is `deepseek` or `openai`. The OpenAI SDK appends `/chat/completions` to `base_url` itself.
- `ADMIN_DEV_TOKEN` must remain empty in production (unchanged from prior work).
- The DeepSeek/OpenAI keys currently in `backend/.env` are compromised (committed in plaintext historically) and MUST be rotated before the rotated values are stored in Secrets Store. Do not read, echo, or copy the current `backend/.env` secret values.
- Do not touch `backend/.env` (the real secrets file) in code changes — only `backend/.env.example`.
- All commands run on Windows from the `backend/` directory using the existing venv: `venv/Scripts/python.exe`.

---

### Task 1: Establish the pytest harness

The project has no test suite yet. This task adds pytest so every later task has a red/green cycle. Deliverable: `pytest` runs and collects a passing smoke test.

**Files:**
- Modify: `backend/requirements.txt` (append test deps)
- Create: `backend/pytest.ini`
- Create: `backend/conftest.py`
- Test: `backend/tests/test_smoke.py`

**Interfaces:**
- Consumes: nothing.
- Produces: an importable test environment where `import main` and `import rag_store` resolve when pytest runs from `backend/`. `pytest.ini` sets `asyncio_mode = auto` so later async tests need no per-test decorator.

- [ ] **Step 1: Add test dependencies to requirements**

Append to `backend/requirements.txt`:

```text
# --- Testing ---
pytest==8.2.2
pytest-asyncio==0.23.8
```

- [ ] **Step 2: Install the new deps**

Run (from `backend/`): `venv/Scripts/python.exe -m pip install pytest==8.2.2 pytest-asyncio==0.23.8`
Expected: ends with `Successfully installed pytest-8.2.2 pytest-asyncio-0.23.8` (or "already satisfied").

- [ ] **Step 3: Create pytest.ini**

Create `backend/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

- [ ] **Step 4: Create conftest.py so `backend/` is importable**

Create `backend/conftest.py`:

```python
import os
import sys

# Ensure the backend package root (this dir) is importable so tests can
# `import main` / `import rag_store` regardless of pytest's invocation dir.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
```

- [ ] **Step 5: Write the smoke test**

Create `backend/tests/test_smoke.py`:

```python
def test_backend_modules_import():
    import main
    import rag_store
    assert hasattr(rag_store, "DEFAULT_CONFIG")
    assert hasattr(main, "app")
```

- [ ] **Step 6: Run the smoke test**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_smoke.py -v`
Expected: PASS — `1 passed`.

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini backend/conftest.py backend/tests/test_smoke.py
git commit -m "test: establish pytest harness for backend"
```

---

### Task 2: AI Gateway connection-config helper

Add a pure function that composes the gateway connection details (base URL, api-key reference, auth header) for a cloud provider. Isolating this makes the URL/header contract unit-testable without a live gateway or the SDK.

**Files:**
- Modify: `backend/main.py` (add helper near the client setup, ~line 82)
- Test: `backend/tests/test_gateway.py`

**Interfaces:**
- Consumes: env vars `CF_ACCOUNT_ID`, `CF_AIG_GATEWAY`, `CF_AIG_TOKEN`, `DEEPSEEK_KEY_REF`, `OPENAI_KEY_REF` (read fresh on each call).
- Produces: `aig_provider_config(provider: str) -> dict` returning keys `base_url` (str), `api_key` (str, never empty), `headers` (dict — contains `cf-aig-authorization` when a token is set, else empty). `provider` is `"deepseek"` or `"openai"`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_gateway.py`:

```python
import main


def test_deepseek_config_routes_through_gateway(monkeypatch):
    monkeypatch.setenv("CF_ACCOUNT_ID", "acct123")
    monkeypatch.setenv("CF_AIG_GATEWAY", "uknow-gw")
    monkeypatch.setenv("CF_AIG_TOKEN", "cf-tok")
    monkeypatch.setenv("DEEPSEEK_KEY_REF", "DEEPSEEK_KEY_1")

    cfg = main.aig_provider_config("deepseek")

    assert cfg["base_url"] == "https://gateway.ai.cloudflare.com/v1/acct123/uknow-gw/deepseek"
    assert cfg["api_key"] == "DEEPSEEK_KEY_1"
    assert cfg["headers"]["cf-aig-authorization"] == "Bearer cf-tok"


def test_openai_config_uses_openai_ref(monkeypatch):
    monkeypatch.setenv("CF_ACCOUNT_ID", "acct123")
    monkeypatch.setenv("CF_AIG_GATEWAY", "uknow-gw")
    monkeypatch.setenv("CF_AIG_TOKEN", "cf-tok")
    monkeypatch.setenv("OPENAI_KEY_REF", "OPENAI_KEY_1")

    cfg = main.aig_provider_config("openai")

    assert cfg["base_url"].endswith("/uknow-gw/openai")
    assert cfg["api_key"] == "OPENAI_KEY_1"


def test_api_key_never_empty_even_without_ref(monkeypatch):
    # The OpenAI SDK rejects an empty api_key at construction; the helper must
    # always return a non-empty placeholder (the gateway ignores it under BYOK).
    monkeypatch.delenv("DEEPSEEK_KEY_REF", raising=False)
    monkeypatch.setenv("CF_ACCOUNT_ID", "a")
    monkeypatch.setenv("CF_AIG_GATEWAY", "g")
    monkeypatch.delenv("CF_AIG_TOKEN", raising=False)

    cfg = main.aig_provider_config("deepseek")

    assert cfg["api_key"] == "unused"
    assert cfg["headers"] == {}  # no token -> no auth header
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_gateway.py -v`
Expected: FAIL with `AttributeError: module 'main' has no attribute 'aig_provider_config'`.

- [ ] **Step 3: Implement the helper**

In `backend/main.py`, immediately after the `load_config()` function (before the `# Setup AI Clients` comment at ~line 82), insert:

```python
# --- Cloudflare AI Gateway (BYOK) --------------------------------------------
# Cloud providers are reached THROUGH the gateway, not directly. Two headers do
# the work: `cf-aig-authorization` authenticates us to the gateway, and the
# SDK's api_key carries the Secrets Store *reference name* the gateway swaps for
# the real provider key (BYOK). Raw provider keys never live on this host.
def aig_provider_config(provider: str) -> dict:
    """Compose AI Gateway connection details for a cloud provider.

    Returns {base_url, api_key, headers}. Reads env fresh so it is unit-testable
    and reflects rotated config without a code change. `provider` is
    'deepseek' or 'openai'.
    """
    account = os.getenv("CF_ACCOUNT_ID", "")
    gateway = os.getenv("CF_AIG_GATEWAY", "")
    token = os.getenv("CF_AIG_TOKEN", "")
    key_ref = os.getenv(f"{provider.upper()}_KEY_REF", "")
    base_url = f"https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/{provider}"
    headers = {"cf-aig-authorization": f"Bearer {token}"} if token else {}
    # api_key must be non-empty (SDK requirement); the gateway ignores it under
    # BYOK and uses the stored key named by key_ref instead.
    return {"base_url": base_url, "api_key": key_ref or "unused", "headers": headers}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_gateway.py -v`
Expected: PASS — `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_gateway.py
git commit -m "feat: add AI Gateway BYOK connection-config helper"
```

---

### Task 3: Route clients through the gateway + fix provider readiness + update env docs

Replace the direct-to-vendor client construction with gateway-routed clients built from Task 2's helper, replace the provider key-presence checks, and update the env blueprint + setup docs so the legacy keys are gone everywhere.

**Files:**
- Modify: `backend/main.py:87-88` (client construction) and `backend/main.py:584-587` (provider readiness in `/api/admin/models`)
- Modify: `backend/.env.example:27-29`
- Modify: `SETUP.md:44-50`
- Test: `backend/tests/test_gateway.py` (extend)

**Interfaces:**
- Consumes: `aig_provider_config(provider)` from Task 2.
- Produces:
  - `build_provider_client(provider: str) -> AsyncOpenAI` — an AsyncOpenAI client bound to the gateway for that provider.
  - `provider_ready(provider: str) -> bool` — True when the gateway env (`CF_ACCOUNT_ID`, `CF_AIG_GATEWAY`, `CF_AIG_TOKEN`) and the provider's `{PROVIDER}_KEY_REF` are all set.
  - Module-level `deepseek_client` and `openai_client` now point at the gateway (same names, so `resolve_client` and streaming code are unchanged).

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_gateway.py`:

```python
def test_provider_ready_true_when_gateway_and_ref_set(monkeypatch):
    monkeypatch.setenv("CF_ACCOUNT_ID", "a")
    monkeypatch.setenv("CF_AIG_GATEWAY", "g")
    monkeypatch.setenv("CF_AIG_TOKEN", "t")
    monkeypatch.setenv("DEEPSEEK_KEY_REF", "ref")
    assert main.provider_ready("deepseek") is True


def test_provider_ready_false_when_token_missing(monkeypatch):
    monkeypatch.setenv("CF_ACCOUNT_ID", "a")
    monkeypatch.setenv("CF_AIG_GATEWAY", "g")
    monkeypatch.delenv("CF_AIG_TOKEN", raising=False)
    monkeypatch.setenv("DEEPSEEK_KEY_REF", "ref")
    assert main.provider_ready("deepseek") is False


def test_provider_ready_false_when_key_ref_missing(monkeypatch):
    monkeypatch.setenv("CF_ACCOUNT_ID", "a")
    monkeypatch.setenv("CF_AIG_GATEWAY", "g")
    monkeypatch.setenv("CF_AIG_TOKEN", "t")
    monkeypatch.delenv("OPENAI_KEY_REF", raising=False)
    assert main.provider_ready("openai") is False


def test_build_provider_client_points_at_gateway(monkeypatch):
    monkeypatch.setenv("CF_ACCOUNT_ID", "a")
    monkeypatch.setenv("CF_AIG_GATEWAY", "g")
    monkeypatch.setenv("CF_AIG_TOKEN", "t")
    monkeypatch.setenv("DEEPSEEK_KEY_REF", "ref")
    client = main.build_provider_client("deepseek")
    assert "gateway.ai.cloudflare.com" in str(client.base_url)
    assert str(client.base_url).rstrip("/").endswith("/deepseek")
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_gateway.py -v`
Expected: FAIL — `AttributeError: module 'main' has no attribute 'provider_ready'` (and `build_provider_client`).

- [ ] **Step 3: Replace the client construction**

In `backend/main.py`, replace lines 87-88:

```python
deepseek_client = AsyncOpenAI(base_url="https://api.deepseek.com/v1", api_key=os.getenv("DEEPSEEK_API_KEY", ""))
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
```

with:

```python
def build_provider_client(provider: str) -> AsyncOpenAI:
    """Build an AsyncOpenAI client bound to the AI Gateway for a cloud provider."""
    cfg = aig_provider_config(provider)
    return AsyncOpenAI(
        base_url=cfg["base_url"], api_key=cfg["api_key"], default_headers=cfg["headers"]
    )


def provider_ready(provider: str) -> bool:
    """A cloud tier is callable when the gateway is configured and the provider's
    Secrets Store key reference is set. Replaces the old raw-key presence check."""
    gateway_ok = all(
        os.getenv(v) for v in ("CF_ACCOUNT_ID", "CF_AIG_GATEWAY", "CF_AIG_TOKEN")
    )
    return bool(gateway_ok and os.getenv(f"{provider.upper()}_KEY_REF"))


# DeepSeek + OpenAI are reached through the gateway (BYOK); Ollama stays direct.
deepseek_client = build_provider_client("deepseek")
openai_client = build_provider_client("openai")
```

- [ ] **Step 4: Replace the provider-readiness check**

In `backend/main.py`, in the `/api/admin/models` response (currently lines 584-587), replace:

```python
        "providers": {
            "deepseek": bool(os.getenv("DEEPSEEK_API_KEY")),
            "openai": bool(os.getenv("OPENAI_API_KEY")),
        },
```

with:

```python
        "providers": {
            "deepseek": provider_ready("deepseek"),
            "openai": provider_ready("openai"),
        },
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/ -v`
Expected: PASS — all tests green (smoke + gateway).

- [ ] **Step 6: Verify no legacy key references remain in backend code**

Run (from `backend/`): `venv/Scripts/python.exe -c "import pathlib,sys; t=pathlib.Path('main.py').read_text(encoding='utf-8'); sys.exit('LEGACY KEY STILL REFERENCED' if ('DEEPSEEK_API_KEY' in t or 'OPENAI_API_KEY' in t) else 'clean')"`
Expected: prints `clean` and exits 0.

- [ ] **Step 7: Update the env blueprint**

In `backend/.env.example`, replace lines 27-29:

```ini
# --- Protected Cloud Vendor API keys (server-side only) -------------
OPENAI_API_KEY=sk-proj-EncryptedSecretKeyHere...
DEEPSEEK_API_KEY=sk-ds-EncryptedSecretKeyHere...
```

with:

```ini
# --- Cloudflare AI Gateway (BYOK) -----------------------------------
# Cloud LLM calls route THROUGH the gateway. Raw provider keys are NOT stored
# here or anywhere on this host — they live in Cloudflare Secrets Store and are
# referenced by name below. The only cloud secret on this host is CF_AIG_TOKEN.
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_AIG_GATEWAY=your_gateway_id
CF_AIG_TOKEN=your_gateway_auth_token          # rotatable, spend-limited
DEEPSEEK_KEY_REF=DEEPSEEK_KEY_1               # Secrets Store reference name
OPENAI_KEY_REF=OPENAI_KEY_1                   # Secrets Store reference name
```

- [ ] **Step 8: Update SETUP.md cloud-key instructions**

In `SETUP.md`, replace lines 44-50:

```ini
# Cloud keys — paste your NEWLY ROTATED keys here (never commit this file).
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
```

> 🔴 **Rotate your OpenAI + DeepSeek keys first** — the old ones were committed
> in plaintext and must be considered compromised.

with:

```ini
# Cloudflare AI Gateway (BYOK) — cloud calls route through the gateway.
# Raw provider keys are NOT stored here; they live in Cloudflare Secrets Store.
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_AIG_GATEWAY=your_gateway_id
CF_AIG_TOKEN=your_gateway_auth_token
DEEPSEEK_KEY_REF=DEEPSEEK_KEY_1
OPENAI_KEY_REF=OPENAI_KEY_1
```

> 🔴 **Rotate your OpenAI + DeepSeek keys first**, then add the rotated keys to
> Cloudflare Secrets Store via **AI Gateway → Provider Keys → Add** (BYOK). The
> old keys were committed in plaintext and are compromised. The only cloud
> secret that belongs on this host is `CF_AIG_TOKEN`.

- [ ] **Step 9: Commit**

```bash
git add backend/main.py backend/tests/test_gateway.py backend/.env.example SETUP.md
git commit -m "feat: route DeepSeek/OpenAI through AI Gateway BYOK, drop host-side keys"
```

---

### Task 4: Flip the default model to DeepSeek

Make DeepSeek the default active model and the head of the fallback chain, so a fresh install defaults to DeepSeek with Ollama as optional and OpenAI last.

**Files:**
- Modify: `backend/rag_store.py:90-96` (`DEFAULT_CONFIG`)
- Test: `backend/tests/test_defaults.py`

**Interfaces:**
- Consumes: `rag_store.DEFAULT_CONFIG`, `rag_store.connect`, `rag_store.ensure_schema`, `main.build_fallback_chain`.
- Produces: `DEFAULT_CONFIG["active_model"] == "deepseek"` and `DEFAULT_CONFIG["fallback_chain"] == ["deepseek", "ollama-local", "openai"]`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_defaults.py`:

```python
import main
import rag_store


def test_default_active_model_is_deepseek():
    assert rag_store.DEFAULT_CONFIG["active_model"] == "deepseek"


def test_default_fallback_chain_is_deepseek_first():
    assert rag_store.DEFAULT_CONFIG["fallback_chain"] == [
        "deepseek",
        "ollama-local",
        "openai",
    ]


def test_fallback_chain_prefers_deepseek_with_default_config():
    cfg = dict(rag_store.DEFAULT_CONFIG)
    con = rag_store.connect(":memory:")
    try:
        rag_store.ensure_schema(con)
        chain = main.build_fallback_chain(cfg, con, want_smart=False)
    finally:
        con.close()
    assert chain[0] == "deepseek"
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_defaults.py -v`
Expected: FAIL — `assert 'ollama-local' == 'deepseek'`.

- [ ] **Step 3: Edit the defaults**

In `backend/rag_store.py`, in `DEFAULT_CONFIG`, change:

```python
    "active_model": "ollama-local",
```
to:
```python
    "active_model": "deepseek",
```

and change:

```python
    "fallback_chain": ["ollama-local", "deepseek", "openai"],
```
to:
```python
    "fallback_chain": ["deepseek", "ollama-local", "openai"],
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_defaults.py -v`
Expected: PASS — `3 passed`.

- [ ] **Step 5: Run the full suite to confirm nothing regressed**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/ -v`
Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add backend/rag_store.py backend/tests/test_defaults.py
git commit -m "feat: default to DeepSeek with Ollama optional, OpenAI last"
```

---

## Post-Implementation: Owner-Only Ops (not code — do after the tasks land)

These require the user's Cloudflare account and cannot be done in code. They gate the switch to production:

1. In the Cloudflare dashboard, create an **AI Gateway**; enable **Authenticated Gateway** and note the gateway id.
2. **Rotate** the DeepSeek and OpenAI keys at each vendor (the current `backend/.env` values are compromised).
3. Add the rotated keys via **AI Gateway → Provider Keys → Add** (stored in Secrets Store); note each key's reference name/alias for `DEEPSEEK_KEY_REF` / `OPENAI_KEY_REF`.
4. Create a gateway **auth token** (`Run` permission) → set `CF_AIG_TOKEN` on the Mac Mini only.
5. Configure a **spend limit** (e.g. per-day USD cap) on the gateway.
6. Set `CF_ACCOUNT_ID`, `CF_AIG_GATEWAY`, `DEEPSEEK_KEY_REF`, `OPENAI_KEY_REF` in `backend/.env`.
7. Delete `DEEPSEEK_API_KEY` and `OPENAI_API_KEY` from `backend/.env` (no longer read by any code).
8. Smoke-test a live chat: it should route to DeepSeek and stream a clean response.

---

## Self-Review

**Spec coverage (Phase A rows of spec §9 + §4.1/§4.2/§10):**
- §4.1 AI Gateway integration (clients at gateway base URL, `cf-aig-authorization`, keys by reference, new env vars) → Tasks 2 & 3. ✅
- §4.2 Default model flip (`active_model="deepseek"`, `deepseek → ollama-local → openai`) → Task 4. ✅
- §9 Phase A: BYOK wiring, default flip, migrate keys out, remove legacy env vars → Tasks 2–4 (code) + Ops steps (owner actions). ✅
- §10 Manual ops (gateway create, key rotation, token, spend limit, remove legacy keys) → Post-Implementation Ops section. ✅
- Out of Phase A (deferred to their own plans): RAG registry/multi-DB (§4.3), chat pickers (§4.4), OpenAI password gate (§4.5), model-first prompt (§4.6), web-fetch. Correctly excluded.

**Placeholder scan:** No TBD/TODO; every code step shows full code; every command shows expected output. ✅

**Type consistency:** `aig_provider_config` (Task 2) returns `{base_url, api_key, headers}`, consumed identically by `build_provider_client` (Task 3). `provider_ready` used consistently in code + tests. `build_fallback_chain(cfg, con, want_smart)` signature matches the existing definition in `main.py`. ✅
