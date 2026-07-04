"""
rag_store.py — SQLite + sqlite-vec data layer for the RAG pipeline (Phase 2).

Design notes
------------
* This module is intentionally free of any network / Ollama code. It only deals
  with the database and *already-computed* embedding vectors. The caller
  (main.py) is responsible for turning text into vectors via Ollama. That keeps
  this layer pure and unit-testable without a running model.
* Vectors live in a sqlite-vec `vec0` virtual table (`vec_chunks`) keyed by the
  same integer rowid as `document_chunks`, so a plain JOIN reunites a vector hit
  with its chunk + parent document. The legacy `document_chunks.embedding` BLOB
  column is left untouched.
* Everything operates on the existing rag.db schema discovered in Phase 2
  (knowledge_bases -> documents -> document_chunks), so uploads flow into the
  same structure the 453 seeded chunks already use.
"""

import os
import uuid
import hashlib
import datetime
from typing import Optional, List, Dict, Any

import sqlite3
import sqlite_vec

# --- Configuration -----------------------------------------------------------
_HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.getenv("RAG_DB_PATH", os.path.join(_HERE, "..", "rag.db"))
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
# nomic-embed-text = 768 dims. Change EMBED_DIM if you pick another model, but
# note the vec0 table's dimension is fixed at creation time.
EMBED_DIM = int(os.getenv("EMBED_DIM", "768"))
# Knowledge base (by `code`) that user uploads land in by default.
DEFAULT_KB_CODE = os.getenv("RAG_DEFAULT_KB", "general_customer")


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def connect(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Open a connection with the sqlite-vec extension loaded."""
    con = sqlite3.connect(db_path or DB_PATH)
    con.row_factory = sqlite3.Row
    con.enable_load_extension(True)
    sqlite_vec.load(con)
    con.enable_load_extension(False)
    con.execute("PRAGMA foreign_keys = ON")
    return con


def ensure_schema(con: sqlite3.Connection) -> None:
    """Create the vector + config/usage tables if absent (idempotent)."""
    con.execute(
        f"CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(embedding float[{EMBED_DIM}])"
    )
    # App config (replaces the in-memory APP_STATE) — a tiny key/value table.
    con.execute(
        """CREATE TABLE IF NOT EXISTS app_settings (
               key TEXT PRIMARY KEY,
               value TEXT NOT NULL,
               updated_at TEXT NOT NULL
           )"""
    )
    # Per-call usage/cost ledger for budget enforcement + admin dashboards.
    con.execute(
        """CREATE TABLE IF NOT EXISTS usage_log (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               provider TEXT NOT NULL,
               model TEXT,
               prompt_tokens INTEGER DEFAULT 0,
               completion_tokens INTEGER DEFAULT 0,
               total_tokens INTEGER DEFAULT 0,
               cost_usd REAL DEFAULT 0,
               created_at TEXT NOT NULL
           )"""
    )
    con.commit()


# --- Config (app_settings) ---------------------------------------------------
import json as _json

DEFAULT_CONFIG = {
    "active_model": "deepseek",
    # Monthly USD budget per cloud provider (mirrors the admin panel defaults).
    "budgets": {"deepseek": 10.0, "openai": 20.0},
    # Ordered failover priority. The chat path tries active_model first, then
    # walks this chain, skipping over-budget/unavailable tiers (Phase 3).
    "fallback_chain": ["deepseek", "ollama-local", "openai"],
    # Use-case → local Ollama model map (G1). Intent detection picks one.
    "local_models": {
        "coding": "qwen2.5-coder:7b",
        "general": "llama3.2:3b",
        "fast": "deepseek-r1:1.5b",
    },
    # Where "smart"/Lao requests route, and whether Lao auto-routes there (G2).
    "smart_model": "openai",
    "auto_lao_to_smart": True,
    # How the local model is chosen: "auto" = use-case routing above;
    # "manual" = always use `local_model_default`.
    "model_mode": "auto",
    "local_model_default": "",
}

# Config keys whose value is a dict that should be *merged* with defaults
# (so a partially-stored config keeps default sub-keys).
_MERGE_KEYS = ("budgets", "local_models")


def get_config(con: sqlite3.Connection) -> Dict[str, Any]:
    """Return the persisted app config, seeded with defaults for missing keys."""
    row = con.execute(
        "SELECT value FROM app_settings WHERE key = 'app_config'"
    ).fetchone()
    cfg = dict(DEFAULT_CONFIG)
    if row:
        try:
            stored = _json.loads(row["value"])
            cfg.update(stored)
            # Merge nested dict keys so a partial stored config keeps defaults.
            for key in _MERGE_KEYS:
                merged = dict(DEFAULT_CONFIG[key])
                merged.update(stored.get(key, {}))
                cfg[key] = merged
        except Exception:
            pass
    return cfg


def save_config(con: sqlite3.Connection, cfg: Dict[str, Any]) -> None:
    con.execute(
        """INSERT INTO app_settings(key, value, updated_at)
           VALUES ('app_config', ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                          updated_at = excluded.updated_at""",
        (_json.dumps(cfg), _now()),
    )
    con.commit()


# --- Usage / spend ledger ----------------------------------------------------
def record_usage(
    con: sqlite3.Connection,
    provider: str,
    model: Optional[str],
    prompt_tokens: int,
    completion_tokens: int,
    cost_usd: float,
) -> None:
    con.execute(
        """INSERT INTO usage_log
           (provider, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (provider, model, prompt_tokens, completion_tokens,
         prompt_tokens + completion_tokens, cost_usd, _now()),
    )
    con.commit()


def month_spend_usd(con: sqlite3.Connection, provider: Optional[str] = None) -> float:
    """Sum cost_usd for the current calendar month (UTC), optionally per provider."""
    month_prefix = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m")
    if provider:
        row = con.execute(
            "SELECT COALESCE(SUM(cost_usd),0) AS s FROM usage_log "
            "WHERE provider = ? AND substr(created_at,1,7) = ?",
            (provider, month_prefix),
        ).fetchone()
    else:
        row = con.execute(
            "SELECT COALESCE(SUM(cost_usd),0) AS s FROM usage_log "
            "WHERE substr(created_at,1,7) = ?",
            (month_prefix,),
        ).fetchone()
    return float(row["s"])


def kb_id_for_code(con: sqlite3.Connection, code: str) -> Optional[str]:
    row = con.execute(
        "SELECT id FROM knowledge_bases WHERE code = ?", (code,)
    ).fetchone()
    return row["id"] if row else None


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


# --- Ingestion ---------------------------------------------------------------
def create_document(
    con: sqlite3.Connection,
    kb_id: str,
    title: str,
    source_type: str = "upload",
    mime_type: Optional[str] = None,
    access_level: str = "public",
    created_by: Optional[str] = None,
) -> str:
    """Insert a `documents` row and return its id."""
    doc_id = _gen_id("doc")
    ts = _now()
    con.execute(
        """INSERT INTO documents
           (id, knowledge_base_id, title, source_type, mime_type,
            access_level, status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'indexed', ?, ?, ?)""",
        (doc_id, kb_id, title, source_type, mime_type, access_level, created_by, ts, ts),
    )
    return doc_id


def add_chunk(
    con: sqlite3.Connection,
    doc_id: str,
    kb_id: str,
    content: str,
    chunk_index: int,
    embedding: List[float],
    section_title: Optional[str] = None,
    access_level: str = "public",
) -> str:
    """Insert one chunk and its vector; returns the chunk id.

    The chunk's integer rowid is reused as the vec_chunks rowid so the two
    tables can be JOINed on rowid during search.
    """
    chunk_id = _gen_id("chunk")
    token_estimate = max(1, len(content) // 4)  # rough heuristic
    cur = con.execute(
        """INSERT INTO document_chunks
           (id, document_id, knowledge_base_id, content, chunk_index,
            token_estimate, access_level, is_enabled, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)""",
        (chunk_id, doc_id, kb_id, content, chunk_index,
         token_estimate, access_level, _now()),
    )
    rowid = cur.lastrowid
    if section_title is not None:
        con.execute(
            "UPDATE document_chunks SET section_title = ? WHERE rowid = ?",
            (section_title, rowid),
        )
    con.execute(
        "INSERT INTO vec_chunks(rowid, embedding) VALUES (?, ?)",
        (rowid, sqlite_vec.serialize_float32(embedding)),
    )
    return chunk_id


def store_vector_for_rowid(
    con: sqlite3.Connection, rowid: int, embedding: List[float]
) -> None:
    """(Backfill) attach a vector to an existing chunk rowid, replacing any prior."""
    con.execute("DELETE FROM vec_chunks WHERE rowid = ?", (rowid,))
    con.execute(
        "INSERT INTO vec_chunks(rowid, embedding) VALUES (?, ?)",
        (rowid, sqlite_vec.serialize_float32(embedding)),
    )


def chunks_missing_vectors(con: sqlite3.Connection) -> List[sqlite3.Row]:
    """Chunks that have no row in vec_chunks yet — the backfill work-list."""
    return con.execute(
        """SELECT dc.rowid AS rowid, dc.id AS id, dc.content AS content
           FROM document_chunks dc
           LEFT JOIN vec_chunks v ON v.rowid = dc.rowid
           WHERE v.rowid IS NULL AND dc.is_enabled = 1
           ORDER BY dc.rowid"""
    ).fetchall()


# --- Retrieval ---------------------------------------------------------------
# Access-level hierarchy, lowest to highest. A role can read its level and below.
ACCESS_HIERARCHY = ["public", "staff", "technical_staff", "admin"]


def levels_for_role(role: Optional[str]) -> List[str]:
    """Which access levels a role may read (its level and everything below it)."""
    if role in ACCESS_HIERARCHY:
        return ACCESS_HIERARCHY[: ACCESS_HIERARCHY.index(role) + 1]
    return ["public"]


def search(
    con: sqlite3.Connection,
    query_embedding: List[float],
    k: int = 4,
    kb_codes: Optional[List[str]] = None,
    allowed_levels: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Return the top-k most similar chunks the caller is allowed to see.

    `allowed_levels` restricts results by `access_level` (role-gating, G3).
    Defaults to public-only when omitted. sqlite-vec KNN needs a bare
    `MATCH ... k` on the vec table, so we over-fetch then filter in the join.
    """
    allowed_levels = allowed_levels or ["public"]
    serialized = sqlite_vec.serialize_float32(query_embedding)
    over = max(k * 8, k)  # over-fetch so post-filters still yield k results
    placeholders = ",".join("?" for _ in allowed_levels)
    # Optional filter to one or more knowledge bases (RAG multi-select).
    kb_filter = ""
    kb_params: List[str] = []
    if kb_codes:
        kb_ph = ",".join("?" for _ in kb_codes)
        kb_filter = f"AND kb.code IN ({kb_ph})"
        kb_params = list(kb_codes)
    rows = con.execute(
        f"""
        WITH knn AS (
            SELECT rowid, distance
            FROM vec_chunks
            WHERE embedding MATCH ? AND k = ?
        )
        SELECT dc.id           AS chunk_id,
               dc.content      AS content,
               dc.section_title AS section_title,
               dc.access_level AS access_level,
               d.title         AS document_title,
               kb.code         AS kb_code,
               knn.distance    AS distance
        FROM knn
        JOIN document_chunks dc ON dc.rowid = knn.rowid
        JOIN documents d        ON d.id = dc.document_id
        JOIN knowledge_bases kb ON kb.id = dc.knowledge_base_id
        WHERE dc.is_enabled = 1
          {kb_filter}
          AND dc.access_level IN ({placeholders})
        ORDER BY knn.distance ASC
        LIMIT ?
        """,
        (serialized, over, *kb_params, *allowed_levels, k),
    ).fetchall()
    return [dict(r) for r in rows]


# --- Admin CRUD --------------------------------------------------------------
def list_chunks(
    con: sqlite3.Connection,
    search_term: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    like = f"%{search_term}%" if search_term else None
    rows = con.execute(
        """SELECT dc.id AS chunk_id, dc.content, dc.section_title,
                  d.title AS document_title, kb.code AS kb_code,
                  dc.created_at,
                  (v.rowid IS NOT NULL) AS has_vector
           FROM document_chunks dc
           JOIN documents d ON d.id = dc.document_id
           JOIN knowledge_bases kb ON kb.id = dc.knowledge_base_id
           LEFT JOIN vec_chunks v ON v.rowid = dc.rowid
           WHERE (? IS NULL OR dc.content LIKE ? OR d.title LIKE ?)
           ORDER BY dc.created_at DESC
           LIMIT ? OFFSET ?""",
        (like, like, like, limit, offset),
    ).fetchall()
    return [dict(r) for r in rows]


def delete_chunk(con: sqlite3.Connection, chunk_id: str) -> bool:
    row = con.execute(
        "SELECT rowid FROM document_chunks WHERE id = ?", (chunk_id,)
    ).fetchone()
    if not row:
        return False
    rowid = row["rowid"]
    con.execute("DELETE FROM vec_chunks WHERE rowid = ?", (rowid,))
    con.execute("DELETE FROM document_chunks WHERE rowid = ?", (rowid,))
    con.commit()
    return True


def purge_knowledge(con: sqlite3.Connection, kb_code: Optional[str] = None) -> Dict[str, int]:
    """Delete chunks + their vectors, optionally scoped to one knowledge base.

    Used to clear the seeded demo content before loading real documents. Leaves
    `documents`/`knowledge_bases` metadata intact to avoid FK cascade surprises;
    fresh uploads create new documents anyway.
    """
    if kb_code:
        kb_id = kb_id_for_code(con, kb_code)
        if not kb_id:
            return {"deleted_chunks": 0}
        rows = con.execute(
            "SELECT rowid FROM document_chunks WHERE knowledge_base_id = ?", (kb_id,)
        ).fetchall()
    else:
        rows = con.execute("SELECT rowid FROM document_chunks").fetchall()

    for r in rows:
        con.execute("DELETE FROM vec_chunks WHERE rowid = ?", (r["rowid"],))
    if kb_code:
        con.execute("DELETE FROM document_chunks WHERE knowledge_base_id = ?", (kb_id,))
    else:
        con.execute("DELETE FROM document_chunks")
    con.commit()
    return {"deleted_chunks": len(rows)}


def stats(con: sqlite3.Connection) -> Dict[str, int]:
    total = con.execute("SELECT COUNT(*) AS c FROM document_chunks").fetchone()["c"]
    vectors = con.execute("SELECT COUNT(*) AS c FROM vec_chunks").fetchone()["c"]
    docs = con.execute("SELECT COUNT(*) AS c FROM documents").fetchone()["c"]
    return {"documents": docs, "chunks": total, "vectors": vectors}


# --- Chunking helper ---------------------------------------------------------
def chunk_text(text: str, max_chars: int = 1500, overlap: int = 150) -> List[str]:
    """Split text into overlapping windows on paragraph boundaries.

    Paragraphs are packed until `max_chars`; an `overlap` tail is carried into
    the next window so context isn't lost across a split.
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: List[str] = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) + 2 <= max_chars:
            current = f"{current}\n\n{para}" if current else para
        else:
            if current:
                chunks.append(current)
            # start next window with an overlap tail of the previous one
            tail = current[-overlap:] if overlap and current else ""
            current = f"{tail}\n\n{para}".strip() if tail else para
            # a single oversized paragraph: hard-split it
            while len(current) > max_chars:
                chunks.append(current[:max_chars])
                current = current[max_chars - overlap:]
    if current:
        chunks.append(current)
    return chunks
