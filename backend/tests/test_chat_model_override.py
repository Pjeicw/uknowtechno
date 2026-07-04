from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_selecting_openai_without_admin_is_rejected():
    """Public visitors (no token) get a 403 pointing them at the admin login."""
    r = client.post("/api/chat", json={
        "messages": [{"role": "user", "content": "hi"}],
        "model": "openai",
    })
    assert r.status_code == 403
    detail = r.json()["detail"].lower()
    assert "admin" in detail


def test_admin_role_unlocks_openai_gate(monkeypatch):
    """With an admin role the request passes the gate (it fails later only if
    no AI tier is reachable, which returns 200 + a polite stream, not 403)."""
    async def fake_role(request):
        return "admin"
    monkeypatch.setattr(main, "resolve_role", fake_role)
    r = client.post("/api/chat", json={
        "messages": [{"role": "user", "content": "hi"}],
        "model": "openai",
    })
    assert r.status_code != 403
