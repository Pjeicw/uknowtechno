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
