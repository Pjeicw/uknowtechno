from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_selecting_openai_is_rejected():
    r = client.post("/api/chat", json={
        "messages": [{"role": "user", "content": "hi"}],
        "model": "openai",
    })
    assert r.status_code == 403
    detail = r.json()["detail"].lower()
    assert "unlock" in detail or "password" in detail
