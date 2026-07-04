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
