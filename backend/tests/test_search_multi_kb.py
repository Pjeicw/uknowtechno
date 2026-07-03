import rag_store
import sqlite_vec


def _seed(con):
    con.execute("CREATE TABLE knowledge_bases (id TEXT PRIMARY KEY, code TEXT)")
    con.execute("CREATE TABLE documents (id TEXT PRIMARY KEY, title TEXT)")
    con.execute(
        """CREATE TABLE document_chunks (
               id TEXT, document_id TEXT, knowledge_base_id TEXT, content TEXT,
               section_title TEXT, access_level TEXT, is_enabled INTEGER)"""
    )
    con.execute("INSERT INTO knowledge_bases VALUES ('kbA','alpha'),('kbB','beta')")
    con.execute("INSERT INTO documents VALUES ('dA','DocA'),('dB','DocB')")
    con.execute(
        "INSERT INTO document_chunks (rowid,id,document_id,knowledge_base_id,content,access_level,is_enabled) "
        "VALUES (1,'cA','dA','kbA','alpha content','public',1)"
    )
    con.execute(
        "INSERT INTO document_chunks (rowid,id,document_id,knowledge_base_id,content,access_level,is_enabled) "
        "VALUES (2,'cB','dB','kbB','beta content','public',1)"
    )
    vA = [1.0] + [0.0] * 767
    vB = [0.0, 1.0] + [0.0] * 766
    con.execute("INSERT INTO vec_chunks(rowid, embedding) VALUES (1, ?)", (sqlite_vec.serialize_float32(vA),))
    con.execute("INSERT INTO vec_chunks(rowid, embedding) VALUES (2, ?)", (sqlite_vec.serialize_float32(vB),))
    con.commit()


def test_search_filters_to_selected_kbs():
    con = rag_store.connect(":memory:")
    try:
        rag_store.ensure_schema(con)
        _seed(con)
        query = [1.0] + [0.0] * 767  # nearest to chunk A (kb 'alpha')
        # Restrict to 'beta' only: A must be excluded even though it's closest.
        hits = rag_store.search(con, query, k=4, kb_codes=["beta"], allowed_levels=["public"])
        assert {h["kb_code"] for h in hits} == {"beta"}
    finally:
        con.close()
