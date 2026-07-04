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
