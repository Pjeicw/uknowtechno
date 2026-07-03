import inspect
import main


def test_retrieve_context_accepts_kb_codes():
    sig = inspect.signature(main.retrieve_context)
    assert "kb_codes" in sig.parameters


async def test_retrieve_context_empty_query_returns_blank():
    # Empty query short-circuits before any DB/embedding call.
    result = await main.retrieve_context("   ", allowed_levels=["public"], kb_codes=["bank"])
    assert result == ""
