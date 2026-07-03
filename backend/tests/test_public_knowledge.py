from fastapi.testclient import TestClient
import main
import rag_store

client = TestClient(main.app)


def test_list_knowledge_bases_returns_code_and_label():
    con = rag_store.connect(":memory:")
    try:
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
