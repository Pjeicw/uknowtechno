import os
import re
import json
import base64
import asyncio
from fastapi import FastAPI, Request, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import httpx
import pypdf
import docx
import pandas as pd
from pydantic import BaseModel
from dotenv import load_dotenv

# Rate limiting (Phase 1 / S5)
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Import OpenAI client (which will handle Ollama, DeepSeek, and OpenAI)
from openai import AsyncOpenAI

# RAG data layer (Phase 2)
import rag_store

load_dotenv()

app = FastAPI(title="UKnowTechno AI Gateway", version="1.0.0")

# --- CORS (Phase 1 / S4) -----------------------------------------------------
# Pin to explicit origins. "*" WITH allow_credentials=True is invalid in browsers
# and insecure — read a comma-separated allow-list from the environment instead.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS", "https://uknowtechno.com,http://localhost:5173"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "PUT", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# --- Rate limiting (Phase 1 / S5) --------------------------------------------
# Behind Cloudflare the real visitor IP arrives in the CF-Connecting-IP header;
# fall back to the socket peer address for direct/local requests.
def client_ip(request: Request) -> str:
    return request.headers.get("CF-Connecting-IP") or get_remote_address(request)

CHAT_RATE_LIMIT = os.getenv("CHAT_RATE_LIMIT", "20/minute")
limiter = Limiter(key_func=client_ip)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- MODELS ---
class TokenBudget(BaseModel):
    active_model: str
    monthly_limit: int
    current_spend: int

# App config now persists in rag.db (app_settings) instead of this in-memory
# mock (Phase 2 / S7). load_config() reads it fresh; a tiny helper below.
def load_config() -> dict:
    try:
        con = rag_store.connect()
        rag_store.ensure_schema(con)
        try:
            return rag_store.get_config(con)
        finally:
            con.close()
    except Exception as e:
        print(f"Config load fell back to defaults ({type(e).__name__}): {e}")
        return dict(rag_store.DEFAULT_CONFIG)

# Setup AI Clients
# Accept OLLAMA_API_URL (used in code) or OLLAMA_HOST (used in older .env files).
ollama_host = os.getenv("OLLAMA_API_URL") or os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
# We use AsyncOpenAI for all three to keep the code consistent. Ollama has an OpenAI-compatible endpoint!
ollama_client = AsyncOpenAI(base_url=f"{ollama_host}/v1", api_key="ollama")
deepseek_client = AsyncOpenAI(base_url="https://api.deepseek.com/v1", api_key=os.getenv("DEEPSEEK_API_KEY", ""))
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

# PocketBase config for real admin-token verification (Phase 1 / S3)
POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090").rstrip("/")
POCKETBASE_ADMIN_COLLECTION = os.getenv("POCKETBASE_ADMIN_COLLECTION", "_superusers")
# LOCAL DEV ONLY: if set, this token is accepted as an admin bearer without
# PocketBase, so you can configure the app locally before wiring auth. Leave
# UNSET (empty) in production.
ADMIN_DEV_TOKEN = os.getenv("ADMIN_DEV_TOKEN", "")
# Staff users (for role-gated chat knowledge, G3). Their record's role field maps
# to an access level; any authenticated user with no role defaults to "staff".
POCKETBASE_USER_COLLECTION = os.getenv("POCKETBASE_USER_COLLECTION", "users")
POCKETBASE_ROLE_FIELD = os.getenv("POCKETBASE_ROLE_FIELD", "role")

# --- Multi-modal config (Phase 5) --------------------------------------------
VISION_MODEL = os.getenv("VISION_MODEL", "llava")        # local Ollama vision model
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")        # faster-whisper size
_whisper_model = None  # lazy-loaded singleton


def _get_whisper():
    """Load the faster-whisper model once, on first use."""
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    return _whisper_model


async def transcribe_audio(raw: bytes, suffix: str = ".webm") -> str:
    """Transcribe audio bytes to text locally via faster-whisper (no cloud)."""
    import tempfile
    def _run() -> str:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tf:
            tf.write(raw)
            tmp_path = tf.name
        try:
            segments, _info = _get_whisper().transcribe(tmp_path)
            return " ".join(seg.text.strip() for seg in segments).strip()
        finally:
            os.remove(tmp_path)
    # Whisper is CPU-bound and blocking -> run off the event loop.
    return await asyncio.to_thread(_run)


def build_vision_content(text: str, images: list) -> list:
    """Build an OpenAI/Ollama-compatible multi-part message: text + image data URIs.

    `images` is a list of (mime_type, raw_bytes). Returns the `content` array.
    """
    parts = [{"type": "text", "text": text or "Describe this image."}]
    for mime, raw in images:
        b64 = base64.b64encode(raw).decode("ascii")
        parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime or 'image/png'};base64,{b64}"},
        })
    return parts


# --- RAG helpers (Phase 2) ---------------------------------------------------
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "4"))
# Max cosine distance to consider a chunk "relevant". Beyond this we drop it so
# we don't inject noise into the prompt. Tune per embedding model.
RAG_MAX_DISTANCE = float(os.getenv("RAG_MAX_DISTANCE", "1.0"))


@app.on_event("startup")
def _init_rag_schema():
    """Ensure the sqlite-vec vector table exists before serving requests."""
    try:
        con = rag_store.connect()
        rag_store.ensure_schema(con)
        con.close()
        print("RAG schema ready:", rag_store.DB_PATH)
    except Exception as e:
        # RAG is a progressive enhancement — never block startup on it.
        print(f"RAG schema init skipped ({type(e).__name__}): {e}")


async def embed_text(text: str) -> list:
    """Embed a single string via the local Ollama embedding model.

    Uses Ollama's OpenAI-compatible /v1/embeddings endpoint (same client we use
    for chat). Raises on failure — callers decide whether to fail open.
    """
    resp = await ollama_client.embeddings.create(
        model=rag_store.EMBED_MODEL, input=text
    )
    return resp.data[0].embedding


# --- Budget enforcement (Phase 2 / S6) --------------------------------------
# Approx cloud prices in USD per 1M tokens: (input, output). Update as vendors change.
MODEL_PRICES = {
    "deepseek-chat": (0.27, 1.10),
    "gpt-4o-mini": (0.15, 0.60),
}


def provider_of(routing_model: str):
    """Map an admin routing choice to a billable cloud provider (or None if local)."""
    return {"deepseek": "deepseek", "openai": "openai"}.get(routing_model)


def estimate_cost(model_name: str, prompt_tokens: int, completion_tokens: int) -> float:
    price_in, price_out = MODEL_PRICES.get(model_name, (0.0, 0.0))
    return (prompt_tokens / 1_000_000) * price_in + (completion_tokens / 1_000_000) * price_out


def is_over_budget(con, provider: str, cfg: dict) -> bool:
    """DEFAULT BUDGET POLICY (tune freely): a cloud provider is 'over budget'
    when its month-to-date spend meets or exceeds its configured monthly USD
    limit. Callers then downgrade to free local Ollama; if that's down too, the
    chat path degrades to a polite message rather than spending more."""
    if not provider:
        return False
    limit = float(cfg.get("budgets", {}).get(provider, 0.0))
    if limit <= 0:
        return False
    return rag_store.month_spend_usd(con, provider) >= limit


# --- Use-case routing (G1) + Lao/smart detection (G2) ------------------------
_CODING_HINTS = re.compile(
    r"```|\b(code|function|def |class |bug|error|exception|stack ?trace|compile|"
    r"debug|python|javascript|typescript|java|c\+\+|sql|regex|async|await|npm|"
    r"pip|git|docker|kubernetes|api|endpoint|refactor)\b",
    re.IGNORECASE,
)


def detect_intent(text: str) -> str:
    """Very light intent classifier: 'coding' vs 'general' (G1)."""
    return "coding" if text and _CODING_HINTS.search(text) else "general"


def is_lao(text: str) -> bool:
    """True if the text contains Lao script (Unicode U+0E80–U+0EFF) (G2)."""
    return any("຀" <= ch <= "໿" for ch in (text or ""))


def pick_local_model(installed: list, preferred: str) -> str:
    """Choose the preferred local model if installed, else match by base name,
    else fall back to whatever's available."""
    if not installed:
        return preferred
    if preferred in installed:
        return preferred
    base = (preferred or "").split(":")[0]
    for mid in installed:
        if mid.split(":")[0] == base:
            return mid
    return installed[0]


def build_fallback_chain(cfg: dict, con, want_smart: bool = False) -> list:
    """Ordered models to try. If want_smart, the smart model (OpenAI) leads;
    then active_model, then the fallback_chain — over-budget cloud tiers dropped."""
    active = cfg.get("active_model", "ollama-local")
    chain = cfg.get("fallback_chain", ["ollama-local", "deepseek", "openai"])
    seq = []
    if want_smart:
        seq.append(cfg.get("smart_model", "openai"))
    seq += [active, *chain]
    ordered, seen = [], set()
    for m in seq:
        if m in seen:
            continue
        seen.add(m)
        prov = provider_of(m)
        if prov and is_over_budget(con, prov, cfg):
            print(f"Skipping {m}: {prov} over budget")
            continue
        ordered.append(m)
    return ordered or ["ollama-local"]


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


async def resolve_client(target_model: str, local_model_pref: str = None):
    """Return (client, model_name, provider) for a model, probing Ollama for a
    live local model. Raises if the tier is unavailable so the caller advances."""
    if target_model == "ollama-local":
        models = await asyncio.wait_for(ollama_client.models.list(), timeout=3.0)
        if not models.data:
            raise RuntimeError("No local models installed in Ollama.")
        installed = [m.id for m in models.data]
        name = pick_local_model(installed, local_model_pref) if local_model_pref else installed[0]
        return ollama_client, name, None
    if target_model == "ollama-vision":
        # Force the configured local vision model (images can't go to text tiers).
        return ollama_client, VISION_MODEL, None
    if target_model == "deepseek":
        return deepseek_client, "deepseek-chat", "deepseek"
    if target_model == "openai":
        return openai_client, "gpt-4o-mini", "openai"
    raise RuntimeError(f"Unknown model '{target_model}'")


async def open_chat_stream(client, model_name: str, messages: list, provider):
    """Open a streaming completion, tolerating older OpenAI SDKs.

    `stream_options={"include_usage": True}` only exists on newer openai SDKs
    (>= ~1.26). On older ones (e.g. 1.12.0) it raises TypeError — we detect that
    and retry without it, falling back to char-based token estimates. This is
    the fix for cloud failover crashing on installs with an older SDK.
    """
    base = dict(model=model_name, messages=messages, stream=True)
    if provider:  # cloud tiers can report token usage; local (Ollama) can't
        try:
            return await client.chat.completions.create(
                **base, stream_options={"include_usage": True}
            )
        except TypeError as e:
            if "stream_options" not in str(e):
                raise
            print("openai SDK lacks stream_options; estimating usage instead")
    return await client.chat.completions.create(**base)


async def resolve_role(request: Request) -> str:
    """Resolve the caller's role from an optional PocketBase user token (G3).

    No/invalid token -> 'public'. A valid staff token -> its role field, or
    'staff' if the record has no role. Fails to 'public' (least privilege)."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return "public"
    token = auth.split(" ", 1)[1].strip()
    url = f"{POCKETBASE_URL}/api/collections/{POCKETBASE_USER_COLLECTION}/auth-refresh"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, headers={"Authorization": token})
        if resp.status_code == 200:
            record = resp.json().get("record", {})
            return record.get(POCKETBASE_ROLE_FIELD) or "staff"
    except Exception as e:
        print(f"Role resolution failed (defaulting to public): {e}")
    return "public"


async def retrieve_context(query: str, allowed_levels: list = None, kb_code: str = None) -> str:
    """Return a formatted context block for `query`, or '' if RAG is unavailable.

    `allowed_levels` gates results by access level (role-based, G3); defaults to
    public-only. Fails OPEN: if Ollama/embeddings are down we simply return no
    context so the chat still works (unlike admin auth, which fails closed).
    """
    if not query.strip():
        return ""
    try:
        query_vec = await embed_text(query)
        con = rag_store.connect()
        try:
            hits = rag_store.search(con, query_vec, k=RAG_TOP_K, kb_code=kb_code, allowed_levels=allowed_levels)
        finally:
            con.close()
    except Exception as e:
        print(f"RAG retrieval skipped ({type(e).__name__}): {e}")
        return ""

    relevant = [h for h in hits if h["distance"] <= RAG_MAX_DISTANCE]
    if not relevant:
        return ""

    blocks = []
    for i, h in enumerate(relevant, 1):
        src = h.get("document_title") or h.get("kb_code") or "knowledge base"
        blocks.append(f"[{i}] (source: {src})\n{h['content']}")
    return (
        "Use the following retrieved context to answer when relevant. "
        "If it doesn't contain the answer, say so.\n\n"
        + "\n\n".join(blocks)
    )

# --- MIDDLEWARE / DEPENDENCIES ---
async def verify_pocketbase_admin(request: Request):
    """
    Verify the caller's bearer token against PocketBase instead of a hardcoded
    string. We call the collection's `auth-refresh` endpoint: PocketBase only
    returns 200 for a valid, unexpired token belonging to that collection.

    Fails CLOSED — any missing token, rejection, or PocketBase outage denies
    access, so an admin route is never accidentally left open.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid admin token")

    token = auth_header.split(" ", 1)[1].strip()

    # Local-dev bypass: accept the configured dev token without PocketBase.
    if ADMIN_DEV_TOKEN and token == ADMIN_DEV_TOKEN:
        print("Admin auth via ADMIN_DEV_TOKEN (local dev mode)")
        return True

    refresh_url = (
        f"{POCKETBASE_URL}/api/collections/{POCKETBASE_ADMIN_COLLECTION}/auth-refresh"
    )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # PocketBase expects the raw token in the Authorization header.
            resp = await client.post(refresh_url, headers={"Authorization": token})
    except Exception as e:
        # PocketBase unreachable -> deny (fail closed), don't leak the reason.
        print(f"Admin auth check failed to reach PocketBase: {e}")
        raise HTTPException(status_code=503, detail="Auth service unavailable")

    if resp.status_code != 200:
        raise HTTPException(status_code=403, detail="Not authorized")
    return True

# --- API ENDPOINTS ---

@app.get("/api/config")
async def get_config():
    """Return public configuration to the frontend with active status checking"""
    state = load_config()["active_model"]
    if state == "ollama-local":
        try:
            # Check if ollama is actually online (wait up to 5s)
            await asyncio.wait_for(ollama_client.models.list(), timeout=5.0)
            return {"status": "online", "model": "Ollama"}
        except Exception as e:
            reason_str = str(e) if str(e) else type(e).__name__
            return {"status": "fallback", "model": "Ollama", "actual": "deepseek", "reason": reason_str}
    return {"status": "online", "model": state}

@app.put("/api/config")
async def update_config(
    config: TokenBudget,
    _admin: bool = Depends(verify_pocketbase_admin),  # config changes are admin-only
):
    """Update model routing and per-provider budget, persisted in rag.db."""
    con = rag_store.connect()
    try:
        rag_store.ensure_schema(con)
        cfg = rag_store.get_config(con)
        cfg["active_model"] = config.active_model
        provider = provider_of(config.active_model)
        if provider:
            cfg.setdefault("budgets", {})[provider] = float(config.monthly_limit)
        rag_store.save_config(con, cfg)
        return {"status": "success", "new_state": cfg}
    finally:
        con.close()

@app.post("/api/admin/upload")
async def upload_rag_document(
    file: UploadFile = File(...),
    _admin: bool = Depends(verify_pocketbase_admin),  # S2: route now requires a valid admin token
):
    """Admin-only endpoint to process and ingest documents into Qdrant Vector DB"""
    content_text = ""
    file_ext = file.filename.split(".")[-1].lower()
    try:
        if file_ext == "pdf":
            reader = pypdf.PdfReader(file.file)
            content_text = "\n".join([page.extract_text() for page in reader.pages])
        elif file_ext == "docx":
            doc = docx.Document(file.file)
            content_text = "\n".join([para.text for para in doc.paragraphs])
        elif file_ext in ["xlsx", "csv"]:
            df = pd.read_excel(file.file) if file_ext == "xlsx" else pd.read_csv(file.file)
            content_text = df.to_markdown()
        elif file_ext in ["txt", "md"]:
            content_text = (await file.read()).decode("utf-8")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")

    if not content_text.strip():
        raise HTTPException(status_code=400, detail="No extractable text in file")

    # --- Ingest: chunk -> embed (Ollama) -> store (sqlite-vec) ---------------
    con = rag_store.connect()
    try:
        rag_store.ensure_schema(con)
        kb_id = rag_store.kb_id_for_code(con, rag_store.DEFAULT_KB_CODE)
        if not kb_id:
            raise HTTPException(
                status_code=500,
                detail=f"Default knowledge base '{rag_store.DEFAULT_KB_CODE}' not found",
            )
        doc_id = rag_store.create_document(
            con, kb_id, title=file.filename, source_type="upload",
            mime_type=file.content_type,
        )
        pieces = rag_store.chunk_text(content_text)
        stored = 0
        for idx, piece in enumerate(pieces):
            try:
                vec = await embed_text(piece)
            except Exception as e:
                # Embedding backend down -> roll back this upload cleanly.
                con.rollback()
                raise HTTPException(
                    status_code=503,
                    detail=f"Embedding model unavailable ({rag_store.EMBED_MODEL}): {e}",
                )
            rag_store.add_chunk(con, doc_id, kb_id, piece, idx, vec)
            stored += 1
        con.commit()
    finally:
        con.close()

    return {
        "status": "success",
        "filename": file.filename,
        "extracted_chars": len(content_text),
        "chunks_stored": stored,
        "document_id": doc_id,
    }


# --- Admin config + usage (read) --------------------------------------------
@app.get("/api/admin/config")
async def admin_get_config(_admin: bool = Depends(verify_pocketbase_admin)):
    """Full persisted config (active model, budgets, fallback chain) for the panel."""
    con = rag_store.connect()
    try:
        rag_store.ensure_schema(con)
        return rag_store.get_config(con)
    finally:
        con.close()


class AdminConfigPatch(BaseModel):
    active_model: Optional[str] = None
    budgets: Optional[dict] = None
    fallback_chain: Optional[list] = None
    local_models: Optional[dict] = None
    smart_model: Optional[str] = None
    auto_lao_to_smart: Optional[bool] = None
    model_mode: Optional[str] = None
    local_model_default: Optional[str] = None


@app.put("/api/admin/config")
async def admin_update_config(
    patch: AdminConfigPatch,
    _admin: bool = Depends(verify_pocketbase_admin),
):
    """Patch any subset of the persisted config (model routing, budgets, chain)."""
    con = rag_store.connect()
    try:
        rag_store.ensure_schema(con)
        cfg = rag_store.get_config(con)
        if patch.active_model is not None:
            cfg["active_model"] = patch.active_model
        if patch.budgets is not None:
            cfg.setdefault("budgets", {}).update(patch.budgets)
        if patch.fallback_chain is not None:
            cfg["fallback_chain"] = patch.fallback_chain
        if patch.local_models is not None:
            cfg.setdefault("local_models", {}).update(patch.local_models)
        if patch.smart_model is not None:
            cfg["smart_model"] = patch.smart_model
        if patch.auto_lao_to_smart is not None:
            cfg["auto_lao_to_smart"] = patch.auto_lao_to_smart
        if patch.model_mode is not None:
            cfg["model_mode"] = patch.model_mode
        if patch.local_model_default is not None:
            cfg["local_model_default"] = patch.local_model_default
        rag_store.save_config(con, cfg)
        return {"status": "success", "config": cfg}
    finally:
        con.close()


@app.get("/api/admin/models")
async def admin_list_models(_admin: bool = Depends(verify_pocketbase_admin)):
    """List installed Ollama models + provider readiness, so the admin panel can
    offer a real dropdown and show which tiers are configured."""
    installed, ollama_online, ollama_error = [], False, None
    try:
        models = await asyncio.wait_for(ollama_client.models.list(), timeout=3.0)
        installed = [m.id for m in models.data]
        ollama_online = True
    except Exception as e:
        ollama_error = str(e) or type(e).__name__

    con = rag_store.connect()
    try:
        rag_store.ensure_schema(con)
        cfg = rag_store.get_config(con)
    finally:
        con.close()

    return {
        "ollama_online": ollama_online,
        "ollama_host": ollama_host,
        "ollama_error": ollama_error,
        "installed_models": installed,
        "providers": {
            "deepseek": bool(os.getenv("DEEPSEEK_API_KEY")),
            "openai": bool(os.getenv("OPENAI_API_KEY")),
        },
        "config": {
            "active_model": cfg.get("active_model"),
            "model_mode": cfg.get("model_mode", "auto"),
            "local_model_default": cfg.get("local_model_default", ""),
            "local_models": cfg.get("local_models", {}),
            "fallback_chain": cfg.get("fallback_chain", []),
            "auto_lao_to_smart": cfg.get("auto_lao_to_smart", True),
        },
    }


@app.get("/api/admin/usage")
async def admin_usage(_admin: bool = Depends(verify_pocketbase_admin)):
    """Month-to-date spend per cloud provider + total (for budget bars)."""
    con = rag_store.connect()
    try:
        rag_store.ensure_schema(con)
        cfg = rag_store.get_config(con)
        return {
            "month_spend": {
                "deepseek": rag_store.month_spend_usd(con, "deepseek"),
                "openai": rag_store.month_spend_usd(con, "openai"),
                "total": rag_store.month_spend_usd(con),
            },
            "budgets": cfg.get("budgets", {}),
        }
    finally:
        con.close()


# --- Admin RAG management (Phase 2) -----------------------------------------
@app.get("/api/admin/rag")
async def list_rag_chunks(
    q: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    _admin: bool = Depends(verify_pocketbase_admin),
):
    """List stored chunks (optionally filtered by a search term)."""
    con = rag_store.connect()
    try:
        return {"chunks": rag_store.list_chunks(con, q, limit, offset),
                "stats": rag_store.stats(con)}
    finally:
        con.close()


@app.delete("/api/admin/rag/{chunk_id}")
async def delete_rag_chunk(
    chunk_id: str,
    _admin: bool = Depends(verify_pocketbase_admin),
):
    """Delete a single chunk and its vector."""
    con = rag_store.connect()
    try:
        if not rag_store.delete_chunk(con, chunk_id):
            raise HTTPException(status_code=404, detail="Chunk not found")
        return {"status": "deleted", "chunk_id": chunk_id}
    finally:
        con.close()


@app.post("/api/admin/rag/purge")
async def purge_rag(
    kb_code: Optional[str] = None,
    _admin: bool = Depends(verify_pocketbase_admin),
):
    """Delete all chunks + vectors (optionally for one knowledge base).

    Use to clear the seeded bank-demo content before loading real documents.
    """
    con = rag_store.connect()
    try:
        rag_store.ensure_schema(con)
        result = rag_store.purge_knowledge(con, kb_code)
        return {"status": "purged", **result, "stats": rag_store.stats(con)}
    finally:
        con.close()


@app.post("/api/admin/rag/backfill")
async def backfill_embeddings(
    limit: int = 100,
    _admin: bool = Depends(verify_pocketbase_admin),
):
    """Embed existing chunks that have no vector yet (e.g. the seeded 453).

    Processes up to `limit` chunks per call so a huge backlog can be done in
    batches without a single long-running request.
    """
    con = rag_store.connect()
    try:
        rag_store.ensure_schema(con)
        pending = rag_store.chunks_missing_vectors(con)[:limit]
        done = 0
        for row in pending:
            try:
                vec = await embed_text(row["content"])
            except Exception as e:
                con.commit()
                raise HTTPException(
                    status_code=503,
                    detail=f"Embedding model unavailable after {done}: {e}",
                )
            rag_store.store_vector_for_rowid(con, row["rowid"], vec)
            done += 1
        con.commit()
        remaining = len(rag_store.chunks_missing_vectors(con))
        return {"status": "ok", "embedded": done, "remaining": remaining,
                "stats": rag_store.stats(con)}
    finally:
        con.close()

@app.post("/api/chat")
@limiter.limit(CHAT_RATE_LIMIT)  # S5: throttle public traffic to protect tokens + Ollama
async def chat_endpoint(request: Request):
    """
    Main Chat Endpoint for the public UI.

    Accepts either:
      * JSON:      { "messages": [{"role":"user","content":"hello"}] }
      * multipart: field "messages" (JSON string) + optional "audio" and
        "image" file parts (Phase 5 multi-modal).
    """
    images: list = []   # list of (mime_type, raw_bytes)
    audio_text = ""
    smart_flag = False  # "smart mode" toggle from the UI (G2)
    model_choice = None  # per-request model pick from the chat UI
    kb_choice = None     # per-request knowledge-base pick from the chat UI
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        form = await request.form()
        messages = json.loads(form.get("messages") or "[]")
        smart_flag = str(form.get("smart", "")).lower() in ("1", "true", "yes")
        model_choice = form.get("model") or None
        kb_choice = form.get("kb") or None
        # Voice: transcribe locally, then treat as text (Phase 5).
        audio = form.get("audio")
        if audio is not None:
            try:
                raw = await audio.read()
                suffix = os.path.splitext(audio.filename or "a.webm")[1] or ".webm"
                audio_text = await transcribe_audio(raw, suffix)
            except Exception as e:
                print(f"Audio transcription failed: {e}")
        # Images: collect all "image" parts.
        for key, val in form.multi_items():
            if key == "image" and hasattr(val, "read"):
                images.append((val.content_type, await val.read()))
    else:
        body = await request.json()
        messages = body.get("messages", [])
        smart_flag = bool(body.get("smart", False))
        model_choice = body.get("model") or None
        kb_choice = body.get("kb") or None

    # Map 'ai' role from frontend to 'assistant' for OpenAI SDK compatibility
    for msg in messages:
        if msg.get("role") == "ai":
            msg["role"] = "assistant"

    app_cfg = load_config()
    routing_model = app_cfg["active_model"]

    # Per-request model pick (public). OpenAI is blocked until the unlock gate.
    forced_first, forced_local_pref, model_blocked = resolve_model_choice(model_choice)
    if model_blocked:
        raise HTTPException(status_code=403, detail="OpenAI requires a password unlock (coming soon).")

    # Locate the latest user message; fold in any transcription.
    last_user_idx = next(
        (i for i in range(len(messages) - 1, -1, -1) if messages[i].get("role") == "user"),
        None,
    )
    if audio_text:
        if last_user_idx is None:
            messages.append({"role": "user", "content": audio_text})
            last_user_idx = len(messages) - 1
        else:
            existing = messages[last_user_idx].get("content", "")
            joiner = "\n\n" if existing else ""
            messages[last_user_idx]["content"] = f"{existing}{joiner}[Voice] {audio_text}"

    last_user_text = messages[last_user_idx]["content"] if last_user_idx is not None else ""
    last_user_text = last_user_text if isinstance(last_user_text, str) else ""
    vision_mode = bool(images)

    # Role-gated retrieval (G3): resolve caller's role -> allowed access levels.
    role = await resolve_role(request)
    allowed_levels = rag_store.levels_for_role(role)

    # Routing signals (G1/G2): intent + whether to prefer the smart model.
    intent = detect_intent(last_user_text)
    want_smart = smart_flag or (app_cfg.get("auto_lao_to_smart", True) and is_lao(last_user_text))
    local_models = app_cfg.get("local_models", {})
    # Manual mode = always the admin-chosen model; Auto = use-case routing.
    if forced_local_pref:
        local_model_pref = forced_local_pref
    elif app_cfg.get("model_mode", "auto") == "manual" and app_cfg.get("local_model_default"):
        local_model_pref = app_cfg["local_model_default"]
    else:
        local_model_pref = local_models.get(intent) or local_models.get("general")
    print(f"Chat routing: role={role} mode={app_cfg.get('model_mode','auto')} intent={intent} want_smart={want_smart} local_pref={local_model_pref}")

    # --- RAG: retrieve context for the latest user turn (Phase 2 + G3) -------
    selected_kb = kb_choice if (kb_choice and kb_choice != "none") else None
    rag_context = await retrieve_context(last_user_text, allowed_levels=allowed_levels, kb_code=selected_kb)

    # Images: convert the latest user turn into a vision content array (Phase 5).
    if vision_mode and last_user_idx is not None:
        messages[last_user_idx]["content"] = build_vision_content(last_user_text, images)

    # Setup System Prompt
    base_prompt = (
        "You are the AI assistant for UknowTechno. You speak English and Lao. "
        "Be helpful and concise."
    )
    if rag_context:
        base_prompt = f"{base_prompt}\n\n{rag_context}"
    system_prompt = {"role": "system", "content": base_prompt}

    # We want to make sure the system prompt is first.
    if len(messages) == 0 or messages[0].get("role") != "system":
        messages.insert(0, system_prompt)

    async def generate_response_stream():
        # Images must go to the local vision model; text uses the failover chain.
        if vision_mode:
            candidates = ["ollama-vision"]
        else:
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

        # Walk the chain: first tier that connects wins. A tier that fails to
        # start (Ollama down, bad key, etc.) advances to the next.
        stream = client = provider = None
        model_name = ""
        for target_model in candidates:
            try:
                client, model_name, provider = await resolve_client(target_model, local_model_pref)
            except Exception as e:
                print(f"Tier '{target_model}' unavailable, trying next: {e}")
                continue
            try:
                stream = await open_chat_stream(client, model_name, messages, provider)
                print(f"SUCCESS: Routing to {target_model} (model: {model_name})")
                break
            except Exception as e:
                print(f"Tier '{target_model}' failed to start, trying next: {e}")
                stream = None
                continue

        if stream is None:
            # Every tier exhausted (all down or over budget) -> degrade politely.
            msg = ("All AI engines are currently offline or over the monthly "
                   "budget. Please try again later.")
            yield f"data: {json.dumps({'content': msg})}\n\n"
            yield "data: [DONE]\n\n"
            return

        prompt_tokens = completion_tokens = 0
        completion_chars = 0
        try:
            async for chunk in stream:
                # Usage may arrive in a trailing chunk, as an object OR a dict
                # depending on the SDK/provider (DeepSeek on old SDKs = dict).
                usage = getattr(chunk, "usage", None)
                if usage is not None:
                    if isinstance(usage, dict):
                        prompt_tokens = usage.get("prompt_tokens") or prompt_tokens
                        completion_tokens = usage.get("completion_tokens") or completion_tokens
                    else:
                        prompt_tokens = getattr(usage, "prompt_tokens", None) or prompt_tokens
                        completion_tokens = getattr(usage, "completion_tokens", None) or completion_tokens
                # Content deltas — guard every access; trailing chunks can be empty.
                choices = getattr(chunk, "choices", None)
                if choices:
                    delta = getattr(choices[0], "delta", None)
                    content = getattr(delta, "content", None) if delta is not None else None
                    if content:
                        completion_chars += len(content)
                        yield f"data: {json.dumps({'content': content})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            error_msg = f"Stream interrupted ({provider or 'ollama-local'}): {str(e)}"
            print(error_msg)
            yield f"data: {json.dumps({'content': f'\\n\\n*{error_msg}*'})}\n\n"
            yield "data: [DONE]\n\n"

        # Record usage/cost for cloud calls (S6). Estimate tokens if the vendor
        # didn't return usage; local Ollama is free so we skip it.
        if provider:
            if completion_tokens == 0 and completion_chars:
                completion_tokens = max(1, completion_chars // 4)
            cost = estimate_cost(model_name, prompt_tokens, completion_tokens)
            try:
                rec_con = rag_store.connect()
                try:
                    rag_store.record_usage(rec_con, provider, model_name,
                                           prompt_tokens, completion_tokens, cost)
                finally:
                    rec_con.close()
                print(f"Recorded usage: {provider} {model_name} ~${cost:.5f}")
            except Exception as e:
                print(f"Failed to record usage: {e}")

    return StreamingResponse(generate_response_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
