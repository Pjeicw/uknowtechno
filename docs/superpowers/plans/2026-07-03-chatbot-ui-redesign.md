# Chatbot UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the chat window in the calmer dark + cyan style and give it a working Model picker and Knowledge (RAG) picker, so a visitor can choose which model answers and which knowledge base it consults.

**Architecture:** Frontend `ChatWidget.tsx` gains a top control bar with two dropdowns fed by two new public backend endpoints (`GET /api/models`, `GET /api/knowledge`). The chosen model and knowledge base are sent on each `POST /api/chat` request; the backend honors a per-request model override and knowledge-base filter. OpenAI stays visible but locked (rejected server-side) until the password gate is built in a later plan.

**Tech Stack:** FastAPI (Python), `openai` AsyncOpenAI SDK, SQLite (`rag_store`), pytest for backend; React + TypeScript + Vite + Tailwind + framer-motion for frontend.

## Global Constraints

- Visual style: keep the existing dark navy (`#0a192f`) + cyan (`var(--accent-cyan)` = `#64ffda`) brand, but calmer — reduce neon glow/shadows and oversized fonts. No new color scheme.
- Security: OpenAI must NOT be usable from the public chat yet. A public request selecting `model=openai` is rejected with HTTP 403; the picker shows it locked. The real password gate is a later plan.
- Default behavior: the chat answers from the model's own knowledge; Knowledge defaults to "None". Portfolio/RAG is opt-in per chat.
- Local-first: everything is tested on `http://localhost:5173` (frontend) against the backend on the port set by `VITE_API_BASE` (currently `http://localhost:8001`). Do not touch Cloudflare or the Mac Mini in this plan.
- Backend commands run from `backend/` using `venv/Scripts/python.exe`. Frontend commands run from `frontend/`.
- Admin screen redesign is OUT OF SCOPE here — it is a separate follow-on plan.
- Do not read or modify `backend/.env` (holds live secrets).

---

### Task 1: Backend pytest harness (idempotent)

Adds pytest so backend tasks have a test cycle. If these files already exist from the Phase A security plan, verify and move on.

**Files:**
- Modify: `backend/requirements.txt` (append test deps if absent)
- Create: `backend/pytest.ini` (if absent)
- Create: `backend/conftest.py` (if absent)
- Test: `backend/tests/test_smoke.py`

**Interfaces:**
- Produces: a pytest environment where `import main` and `import rag_store` resolve when run from `backend/`.

- [ ] **Step 1: Add test deps to requirements (skip if already present)**

Ensure `backend/requirements.txt` contains:

```text
# --- Testing ---
pytest==8.2.2
pytest-asyncio==0.23.8
```

- [ ] **Step 2: Install**

Run (from `backend/`): `venv/Scripts/python.exe -m pip install pytest==8.2.2 pytest-asyncio==0.23.8`
Expected: `Successfully installed ...` or "already satisfied".

- [ ] **Step 3: Create pytest.ini (if absent)**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

- [ ] **Step 4: Create conftest.py (if absent)**

```python
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
```

- [ ] **Step 5: Write the smoke test**

Create `backend/tests/test_smoke.py`:

```python
def test_backend_imports():
    import main
    import rag_store
    assert hasattr(main, "app")
    assert hasattr(rag_store, "DEFAULT_CONFIG")
```

- [ ] **Step 6: Run it**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_smoke.py -v`
Expected: PASS — `1 passed`.

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini backend/conftest.py backend/tests/test_smoke.py
git commit -m "test: ensure pytest harness for backend"
```

---

### Task 2: `resolve_model_choice` helper (public model override rules)

A pure function mapping a visitor's model pick to an internal routing decision, with OpenAI blocked. Isolating it makes the rules unit-testable without the HTTP layer.

**Files:**
- Modify: `backend/main.py` (add helper near the routing helpers, after `build_fallback_chain`, ~line 264)
- Test: `backend/tests/test_model_choice.py`

**Interfaces:**
- Produces: `resolve_model_choice(model_choice: Optional[str]) -> tuple[Optional[str], Optional[str], bool]` returning `(forced_first, local_pref, blocked)`.
  - `(None, None, False)` for no choice or `"auto"`.
  - `(None, None, True)` for `"openai"` (blocked — needs unlock).
  - `("deepseek", None, False)` for `"deepseek"`.
  - `("ollama-local", <id>, False)` for any other value (treated as a specific local model id).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_model_choice.py`:

```python
import main


def test_auto_and_empty_are_passthrough():
    assert main.resolve_model_choice(None) == (None, None, False)
    assert main.resolve_model_choice("auto") == (None, None, False)


def test_openai_is_blocked():
    assert main.resolve_model_choice("openai") == (None, None, True)


def test_deepseek_forces_deepseek_first():
    assert main.resolve_model_choice("deepseek") == ("deepseek", None, False)


def test_specific_model_treated_as_local():
    assert main.resolve_model_choice("llama3.2:3b") == ("ollama-local", "llama3.2:3b", False)
```

- [ ] **Step 2: Run to verify it fails**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_model_choice.py -v`
Expected: FAIL — `AttributeError: module 'main' has no attribute 'resolve_model_choice'`.

- [ ] **Step 3: Implement the helper**

In `backend/main.py`, after `build_fallback_chain` (ends ~line 263), insert:

```python
def resolve_model_choice(model_choice: Optional[str]):
    """Map a visitor's model pick to (forced_first, local_pref, blocked).

    `blocked=True` means the choice is not allowed from the public chat yet
    (OpenAI needs a password unlock — a later feature). 'auto'/empty = no
    override. 'deepseek' forces the cloud default first. Anything else is
    treated as a specific local Ollama model id.
    """
    if not model_choice or model_choice == "auto":
        return (None, None, False)
    if model_choice == "openai":
        return (None, None, True)
    if model_choice == "deepseek":
        return ("deepseek", None, False)
    return ("ollama-local", model_choice, False)
```

- [ ] **Step 4: Run to verify it passes**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_model_choice.py -v`
Expected: PASS — `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_model_choice.py
git commit -m "feat: add resolve_model_choice with OpenAI locked for public chat"
```

---

### Task 3: Honor the model override in `/api/chat`

Parse `model` from the request and apply the Task 2 decision: block OpenAI (403), otherwise put the chosen tier first in the failover chain.

**Files:**
- Modify: `backend/main.py` — parsing block (~lines 717-737), routing (~lines 772-778), and `generate_response_stream` candidates (~lines 800-812)
- Test: `backend/tests/test_chat_model_override.py`

**Interfaces:**
- Consumes: `resolve_model_choice` (Task 2), existing `build_fallback_chain`.
- Produces: `/api/chat` accepts optional `model` (JSON field or multipart form field). `model=openai` → HTTP 403. A local-model id becomes the `local_model_pref` and forces the Ollama tier first.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_chat_model_override.py`:

```python
from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_selecting_openai_is_rejected():
    r = client.post("/api/chat", json={
        "messages": [{"role": "user", "content": "hi"}],
        "model": "openai",
    })
    assert r.status_code == 403
    assert "unlock" in r.json()["detail"].lower() or "password" in r.json()["detail"].lower()
```

- [ ] **Step 2: Run to verify it fails**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_chat_model_override.py -v`
Expected: FAIL — status 200 (no rejection yet) instead of 403.

- [ ] **Step 3: Parse `model` in the JSON and multipart branches**

In `backend/main.py` `chat_endpoint`, in the multipart branch add after `smart_flag = ...` (~line 720):

```python
        model_choice = form.get("model") or None
        kb_choice = form.get("kb") or None
```

In the JSON branch add after `smart_flag = bool(body.get("smart", False))` (~line 737):

```python
        model_choice = body.get("model") or None
        kb_choice = body.get("kb") or None
```

- [ ] **Step 4: Apply the override + block OpenAI**

In `backend/main.py`, after `routing_model = app_cfg["active_model"]` (~line 745), insert:

```python
    # Per-request model pick (public). OpenAI is blocked until the unlock gate.
    forced_first, forced_local_pref, model_blocked = resolve_model_choice(model_choice)
    if model_blocked:
        raise HTTPException(status_code=403, detail="OpenAI requires a password unlock (coming soon).")
```

Then, where `local_model_pref` is chosen (~lines 774-777), replace:

```python
    if app_cfg.get("model_mode", "auto") == "manual" and app_cfg.get("local_model_default"):
        local_model_pref = app_cfg["local_model_default"]
    else:
        local_model_pref = local_models.get(intent) or local_models.get("general")
```

with:

```python
    if forced_local_pref:
        local_model_pref = forced_local_pref
    elif app_cfg.get("model_mode", "auto") == "manual" and app_cfg.get("local_model_default"):
        local_model_pref = app_cfg["local_model_default"]
    else:
        local_model_pref = local_models.get(intent) or local_models.get("general")
```

- [ ] **Step 5: Put the forced tier first in the candidate chain**

In `generate_response_stream`, in the non-vision branch (~lines 805-812), replace:

```python
            budget_con = rag_store.connect()
            try:
                rag_store.ensure_schema(budget_con)
                candidates = build_fallback_chain(app_cfg, budget_con, want_smart=want_smart)
            except Exception:
                candidates = [routing_model]
            finally:
                budget_con.close()
```

with:

```python
            budget_con = rag_store.connect()
            try:
                rag_store.ensure_schema(budget_con)
                candidates = build_fallback_chain(app_cfg, budget_con, want_smart=want_smart)
            except Exception:
                candidates = [routing_model]
            finally:
                budget_con.close()
            if forced_first:
                candidates = [forced_first] + [m for m in candidates if m != forced_first]
```

- [ ] **Step 6: Run to verify it passes**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_chat_model_override.py -v`
Expected: PASS — `1 passed`.

- [ ] **Step 7: Commit**

```bash
git add backend/main.py backend/tests/test_chat_model_override.py
git commit -m "feat: honor per-request model choice in /api/chat, block OpenAI"
```

---

### Task 4: Honor the knowledge-base choice in `/api/chat`

Let a request pick which knowledge base to consult. `kb` was already parsed in Task 3; now thread it into retrieval.

**Files:**
- Modify: `backend/main.py` — `retrieve_context` (~lines 328-360) and its call site (~line 781)
- Test: `backend/tests/test_retrieve_kb.py`

**Interfaces:**
- Consumes: `rag_store.search(con, vec, k, kb_code, allowed_levels)` (already supports `kb_code`).
- Produces: `retrieve_context(query, allowed_levels=None, kb_code=None)`. `/api/chat` passes the request's `kb` (unless it is falsy or `"none"`).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_retrieve_kb.py`:

```python
import inspect
import main


def test_retrieve_context_accepts_kb_code():
    sig = inspect.signature(main.retrieve_context)
    assert "kb_code" in sig.parameters


async def test_retrieve_context_empty_query_returns_blank():
    # Empty query short-circuits before any DB/embedding call.
    result = await main.retrieve_context("   ", allowed_levels=["public"], kb_code="bank")
    assert result == ""
```

- [ ] **Step 2: Run to verify it fails**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_retrieve_kb.py -v`
Expected: FAIL — `kb_code` not in signature.

- [ ] **Step 3: Add `kb_code` to `retrieve_context`**

In `backend/main.py`, change the signature (~line 328):

```python
async def retrieve_context(query: str, allowed_levels: list = None) -> str:
```

to:

```python
async def retrieve_context(query: str, allowed_levels: list = None, kb_code: str = None) -> str:
```

and change the search call (~line 341):

```python
            hits = rag_store.search(con, query_vec, k=RAG_TOP_K, allowed_levels=allowed_levels)
```

to:

```python
            hits = rag_store.search(con, query_vec, k=RAG_TOP_K, kb_code=kb_code, allowed_levels=allowed_levels)
```

- [ ] **Step 4: Pass the request's `kb` at the call site**

In `backend/main.py`, change the retrieval call (~line 781):

```python
    rag_context = await retrieve_context(last_user_text, allowed_levels=allowed_levels)
```

to:

```python
    selected_kb = kb_choice if (kb_choice and kb_choice != "none") else None
    rag_context = await retrieve_context(last_user_text, allowed_levels=allowed_levels, kb_code=selected_kb)
```

- [ ] **Step 5: Run to verify it passes**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_retrieve_kb.py -v`
Expected: PASS — `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_retrieve_kb.py
git commit -m "feat: let /api/chat select which knowledge base to consult"
```

---

### Task 5: Public `GET /api/models` endpoint

Feeds the chat's Model dropdown: the default, live Ollama models, and the locked OpenAI entry.

**Files:**
- Modify: `backend/main.py` — add endpoint after `get_config` (~line 413)
- Test: `backend/tests/test_public_models.py`

**Interfaces:**
- Produces: `GET /api/models` → `{ "default": str, "ollama_online": bool, "ollama_models": list[str], "cloud": [ {"id": "deepseek", "label": "DeepSeek", "locked": false}, {"id": "openai", "label": "OpenAI GPT-4o", "locked": true} ] }`. Public (no auth).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_public_models.py`:

```python
from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_models_endpoint_shape():
    r = client.get("/api/models")
    assert r.status_code == 200
    data = r.json()
    assert "ollama_online" in data
    assert isinstance(data["ollama_models"], list)
    ids = [c["id"] for c in data["cloud"]]
    assert "deepseek" in ids and "openai" in ids
    openai = next(c for c in data["cloud"] if c["id"] == "openai")
    assert openai["locked"] is True
```

- [ ] **Step 2: Run to verify it fails**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_public_models.py -v`
Expected: FAIL — 404 (endpoint missing).

- [ ] **Step 3: Implement the endpoint**

In `backend/main.py`, after the `get_config` function (~line 413), insert:

```python
@app.get("/api/models")
async def public_models():
    """Public model list for the chat picker: default + live Ollama + cloud tiers.

    OpenAI is returned locked (requires a password unlock, enforced server-side).
    """
    installed, online = [], False
    try:
        models = await asyncio.wait_for(ollama_client.models.list(), timeout=3.0)
        installed = [m.id for m in models.data]
        online = True
    except Exception:
        pass
    cfg = load_config()
    return {
        "default": cfg.get("active_model", "deepseek"),
        "ollama_online": online,
        "ollama_models": installed,
        "cloud": [
            {"id": "deepseek", "label": "DeepSeek", "locked": False},
            {"id": "openai", "label": "OpenAI GPT-4o", "locked": True},
        ],
    }
```

- [ ] **Step 4: Run to verify it passes**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_public_models.py -v`
Expected: PASS — `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_public_models.py
git commit -m "feat: public GET /api/models for the chat model picker"
```

---

### Task 6: Public `GET /api/knowledge` endpoint (role-filtered)

Feeds the chat's Knowledge dropdown with the knowledge bases the caller may see.

**Files:**
- Modify: `backend/rag_store.py` — add `list_knowledge_bases`
- Modify: `backend/main.py` — add endpoint after `public_models`
- Test: `backend/tests/test_public_knowledge.py`

**Interfaces:**
- Produces:
  - `rag_store.list_knowledge_bases(con, allowed_levels: list[str]) -> list[dict]` → `[{"code": str, "label": str}]` for KBs that have at least one enabled chunk in an allowed access level.
  - `GET /api/knowledge` → `{ "knowledge_bases": [ {"code": str, "label": str}, ... ] }`. Uses `resolve_role` for gating; public callers see only public KBs.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_public_knowledge.py`:

```python
from fastapi.testclient import TestClient
import main
import rag_store

client = TestClient(main.app)


def test_list_knowledge_bases_returns_code_and_label():
    con = rag_store.connect(":memory:")
    try:
        # Minimal schema to exercise the query path without the full seed.
        con.execute("CREATE TABLE knowledge_bases (id TEXT PRIMARY KEY, code TEXT)")
        con.execute("CREATE TABLE document_chunks (rowid INTEGER PRIMARY KEY, knowledge_base_id TEXT, access_level TEXT, is_enabled INTEGER)")
        con.execute("INSERT INTO knowledge_bases VALUES ('kb1','portfolio')")
        con.execute("INSERT INTO document_chunks VALUES (1,'kb1','public',1)")
        con.commit()
        rows = rag_store.list_knowledge_bases(con, ["public"])
        assert rows == [{"code": "portfolio", "label": "Portfolio"}]
    finally:
        con.close()


def test_knowledge_endpoint_shape():
    r = client.get("/api/knowledge")
    assert r.status_code == 200
    assert "knowledge_bases" in r.json()
    assert isinstance(r.json()["knowledge_bases"], list)
```

- [ ] **Step 2: Run to verify it fails**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_public_knowledge.py -v`
Expected: FAIL — `list_knowledge_bases` missing / 404.

- [ ] **Step 3: Add `list_knowledge_bases` to rag_store**

In `backend/rag_store.py`, after `kb_id_for_code` (~line 189), insert:

```python
def list_knowledge_bases(
    con: sqlite3.Connection, allowed_levels: List[str]
) -> List[Dict[str, str]]:
    """Knowledge bases with at least one enabled chunk in an allowed access level.

    Returns [{code, label}] where label is a human-friendly Title Case of the code.
    """
    if not allowed_levels:
        allowed_levels = ["public"]
    placeholders = ",".join("?" for _ in allowed_levels)
    rows = con.execute(
        f"""SELECT DISTINCT kb.code AS code
            FROM knowledge_bases kb
            JOIN document_chunks dc ON dc.knowledge_base_id = kb.id
            WHERE dc.is_enabled = 1 AND dc.access_level IN ({placeholders})
            ORDER BY kb.code""",
        tuple(allowed_levels),
    ).fetchall()
    out = []
    for r in rows:
        code = r["code"]
        label = code.replace("_", " ").replace("-", " ").title()
        out.append({"code": code, "label": label})
    return out
```

- [ ] **Step 4: Add the endpoint**

In `backend/main.py`, after `public_models` (from Task 5), insert:

```python
@app.get("/api/knowledge")
async def public_knowledge(request: Request):
    """Knowledge bases the caller may consult (role-gated via optional staff token)."""
    role = await resolve_role(request)
    allowed_levels = rag_store.levels_for_role(role)
    con = rag_store.connect()
    try:
        rag_store.ensure_schema(con)
        return {"knowledge_bases": rag_store.list_knowledge_bases(con, allowed_levels)}
    except Exception as e:
        print(f"Knowledge list failed ({type(e).__name__}): {e}")
        return {"knowledge_bases": []}
    finally:
        con.close()
```

- [ ] **Step 5: Run to verify it passes**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_public_knowledge.py -v`
Expected: PASS — `2 passed`.

- [ ] **Step 6: Run the full backend suite**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/ -v`
Expected: PASS — all green.

- [ ] **Step 7: Commit**

```bash
git add backend/rag_store.py backend/main.py backend/tests/test_public_knowledge.py
git commit -m "feat: public GET /api/knowledge (role-filtered) for the chat picker"
```

---

### Task 7: Add the Model + Knowledge control bar to the chat window

Wire the two pickers into `ChatWidget.tsx`: fetch options on open, render the control bar, and send the chosen `model` + `kb` on every send.

**Files:**
- Modify: `frontend/src/components/ChatWidget.tsx`
- Verify: `frontend/` build (`npm run build`) + manual browser check

**Interfaces:**
- Consumes: `GET /api/models`, `GET /api/knowledge` (Tasks 5-6); `POST /api/chat` now accepts `model` + `kb`.
- Produces: two `<select>` controls; `selectedModel` (default `"deepseek"`) and `selectedKb` (default `"none"`) included in both the JSON and FormData request bodies.

- [ ] **Step 1: Add state + option types near the other chat state**

In `ChatWidget.tsx`, after `const [smartMode, setSmartMode] = useState(false);` (~line 36), insert:

```tsx
  type ModelOption = { id: string; label: string; locked?: boolean; online?: boolean };
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([{ id: 'deepseek', label: 'DeepSeek' }]);
  const [kbOptions, setKbOptions] = useState<{ code: string; label: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState('deepseek');
  const [selectedKb, setSelectedKb] = useState('none');
```

- [ ] **Step 2: Fetch the picker options when the chat opens**

In `ChatWidget.tsx`, after the `fetchStatus` `useCallback` block (~line 53), insert:

```tsx
  const fetchPickers = useCallback(async () => {
    try {
      const staffToken = localStorage.getItem('staff_token');
      const authHeaders: Record<string, string> = staffToken ? { Authorization: `Bearer ${staffToken}` } : {};
      const [mRes, kRes] = await Promise.all([
        fetch(`${API_BASE}/api/models`),
        fetch(`${API_BASE}/api/knowledge`, { headers: authHeaders }),
      ]);
      if (mRes.ok) {
        const m = await mRes.json();
        const opts: ModelOption[] = [];
        for (const c of m.cloud || []) {
          if (c.id === 'deepseek') opts.push({ id: c.id, label: `${c.label} · default` });
        }
        for (const id of m.ollama_models || []) opts.push({ id, label: `Ollama — ${id}`, online: true });
        for (const c of m.cloud || []) {
          if (c.id === 'openai') opts.push({ id: c.id, label: c.label, locked: !!c.locked });
        }
        setModelOptions(opts.length ? opts : [{ id: 'deepseek', label: 'DeepSeek · default' }]);
      }
      if (kRes.ok) {
        const k = await kRes.json();
        setKbOptions(k.knowledge_bases || []);
      }
    } catch { /* offline: keep defaults */ }
  }, []);
```

- [ ] **Step 3: Call it when the widget opens**

In `ChatWidget.tsx`, find the `useEffect` that runs `fetchStatus` on mount (~lines 85-89) and add a companion effect right after it:

```tsx
  useEffect(() => {
    if (isOpen) fetchPickers();
  }, [isOpen, fetchPickers]);
```

- [ ] **Step 4: Send `model` + `kb` in the request bodies**

In `handleSubmit`, in the FormData branch, after `fd.append('smart', String(smartMode));` (~line 177), insert:

```tsx
      fd.append('model', selectedModel);
      fd.append('kb', selectedKb);
```

In the JSON branch, change the body (~line 187):

```tsx
        body: JSON.stringify({ messages: newMessages, smart: smartMode }),
```

to:

```tsx
        body: JSON.stringify({ messages: newMessages, smart: smartMode, model: selectedModel, kb: selectedKb }),
```

- [ ] **Step 5: Render the control bar under the chat header**

In `ChatWidget.tsx`, locate the end of the header block — the closing `</div>` of the `<div className="p-4 flex justify-between items-center border-b ...">` header (~line 452). Immediately after that closing `</div>` (before the `{/* Chat Messages */}` block), insert:

```tsx
              {/* Model + Knowledge pickers */}
              <div className="flex flex-wrap gap-4 px-4 py-3 border-b border-[#1e293b] bg-[#0a192f]/40">
                <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                  <label className="text-xs text-[var(--accent-cyan)]">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="h-9 px-3 bg-[#0f172a] border border-[#1e293b] rounded-lg text-white text-sm outline-none focus:border-[var(--accent-cyan)]"
                  >
                    {modelOptions.map((m) => (
                      <option key={m.id} value={m.id} disabled={m.locked}>
                        {m.label}{m.locked ? ' 🔒 (needs password)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                  <label className="text-xs text-[var(--accent-cyan)]">Knowledge</label>
                  <select
                    value={selectedKb}
                    onChange={(e) => setSelectedKb(e.target.value)}
                    className="h-9 px-3 bg-[#0f172a] border border-[#1e293b] rounded-lg text-white text-sm outline-none focus:border-[var(--accent-cyan)]"
                  >
                    <option value="none">None · model knowledge</option>
                    {kbOptions.map((k) => (
                      <option key={k.code} value={k.code}>{k.label}</option>
                    ))}
                  </select>
                </div>
              </div>
```

- [ ] **Step 6: Type-check the frontend build**

Run (from `frontend/`): `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 7: Manual browser check**

With the servers running, open `http://localhost:5173`, open the chat. Expected:
- A "Model" dropdown (DeepSeek default; Ollama models if online; OpenAI shown but disabled/🔒) and a "Knowledge" dropdown ("None" plus any knowledge bases).
- Send a message with Model = DeepSeek → a reply streams.
- Pick a Knowledge base and ask about it → the reply reflects that content.
- OpenAI cannot be selected (disabled).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/ChatWidget.tsx
git commit -m "feat: add working model + knowledge pickers to the chat window"
```

---

### Task 8: Calm the chat visuals (dark + cyan, less glow)

Reduce the heaviest neon/oversized styling so the window matches the approved mockup, keeping the brand colors.

**Files:**
- Modify: `frontend/src/components/ChatWidget.tsx`
- Verify: `npm run build` + manual browser check

**Interfaces:**
- Consumes: nothing new. Pure styling changes to existing elements.

- [ ] **Step 1: Soften the AI-engine header title**

In `ChatWidget.tsx`, the header `<h3>` (~line 439) reads:

```tsx
                  <h3 className="text-white font-black tracking-widest flex items-center gap-3 text-lg">
```

Change it to:

```tsx
                  <h3 className="text-white font-medium tracking-normal flex items-center gap-3 text-base">
```

- [ ] **Step 2: Reduce the send-button glow**

In `ChatWidget.tsx`, the submit button (~line 581) has:

```tsx
                      className="p-3 mb-1 mr-1 bg-[var(--accent-cyan)] text-[#0A192F] rounded-xl hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all font-black shadow-md shadow-[var(--accent-cyan)]/30"
```

Change it to:

```tsx
                      className="p-3 mb-1 mr-1 bg-[var(--accent-cyan)] text-[#0A192F] rounded-xl hover:brightness-110 disabled:opacity-50 transition-all font-medium"
```

- [ ] **Step 3: Soften the input container focus glow**

In `ChatWidget.tsx`, the `<form>` (~line 529) has:

```tsx
                <form onSubmit={handleSubmit} className="relative flex flex-col gap-2 bg-[#0f172a]/90 backdrop-blur border border-[#1e293b] hover:border-[var(--accent-cyan)]/30 rounded-2xl p-2 focus-within:border-[var(--accent-cyan)]/60 focus-within:shadow-[0_0_20px_rgba(100,255,218,0.1)] transition-all shadow-xl">
```

Change the class list to remove the outer glow/heavy shadow:

```tsx
                <form onSubmit={handleSubmit} className="relative flex flex-col gap-2 bg-[#0f172a]/90 backdrop-blur border border-[#1e293b] hover:border-[var(--accent-cyan)]/30 rounded-2xl p-2 focus-within:border-[var(--accent-cyan)]/60 transition-all">
```

- [ ] **Step 4: Tone down the launcher button glow**

In `ChatWidget.tsx`, the floating launcher button (~line 599) has:

```tsx
          className="absolute bottom-0 right-0 w-16 h-16 bg-[var(--accent-cyan)] rounded-2xl flex items-center justify-center text-[#0A192F] shadow-[0_0_20px_rgba(100,255,218,0.4)] hover:scale-110 hover:shadow-[0_0_30px_rgba(100,255,218,0.6)] transition-all z-50 overflow-hidden relative group"
```

Change it to:

```tsx
          className="absolute bottom-0 right-0 w-16 h-16 bg-[var(--accent-cyan)] rounded-2xl flex items-center justify-center text-[#0A192F] shadow-[0_0_12px_rgba(100,255,218,0.25)] hover:scale-105 transition-all z-50 overflow-hidden relative group"
```

- [ ] **Step 5: Type-check the build**

Run (from `frontend/`): `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 6: Manual browser check**

Open `http://localhost:5173`, open the chat. Expected: the same dark + cyan look but noticeably calmer — the header text is smaller, and the send button, input box, and launcher no longer have the strong neon glow. The pickers from Task 7 are still present and working.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ChatWidget.tsx
git commit -m "style: calm the chat window glow and oversized text"
```

---

## Self-Review

**Spec coverage (approved mockups + requirements):**
- Model picker in chat (DeepSeek default, Ollama when online, OpenAI locked) → Tasks 2, 3, 5, 7. ✅
- Knowledge (RAG) picker, default "None" (model knowledge) → Tasks 4, 6, 7. ✅
- OpenAI locked / not usable publicly → Task 3 (403) + Task 7 (disabled option). ✅
- Calmer dark + cyan look → Task 8. ✅
- Model-first default (answers from own knowledge unless a KB is chosen) → preserved: KB defaults to "none" (Task 7), retrieval only runs with a KB or existing behavior (Task 4). ✅
- Admin redesign → intentionally deferred to a separate plan (noted in Global Constraints). ✅

**Placeholder scan:** No TBD/TODO. Every code step shows full code; every command shows expected output; frontend steps include an explicit manual-check step. ✅

**Type consistency:** `resolve_model_choice` returns `(forced_first, local_pref, blocked)` (Task 2), consumed exactly so in Task 3. `retrieve_context(query, allowed_levels, kb_code)` defined and called consistently (Task 4). `GET /api/models` shape (`cloud[].id/label/locked`, `ollama_models`) matches the frontend consumer in Task 7. `GET /api/knowledge` returns `knowledge_bases: [{code,label}]`, matching `rag_store.list_knowledge_bases` (Task 6) and the frontend `kbOptions` (Task 7). Request fields `model` + `kb` are produced by the frontend (Task 7) and parsed by the backend (Task 3). ✅

**Note on frontend testing:** This surface has no JS test harness, and the changes are visual/wiring. Verification is `npm run build` (TypeScript compile gate) plus explicit manual browser checks. Backend logic is covered by pytest. Adding a full component-test harness is out of scope for this plan.
