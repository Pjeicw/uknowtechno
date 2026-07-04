import main


def test_auto_and_empty_are_passthrough():
    assert main.resolve_model_choice(None) == (None, None, False)
    assert main.resolve_model_choice("auto") == (None, None, False)


def test_openai_needs_admin():
    # OpenAI is forced first but flagged admin-only (verified in /api/chat).
    assert main.resolve_model_choice("openai") == ("openai", None, True)


def test_deepseek_forces_deepseek_first():
    assert main.resolve_model_choice("deepseek") == ("deepseek", None, False)


def test_specific_model_treated_as_local():
    assert main.resolve_model_choice("llama3.2:3b") == ("ollama-local", "llama3.2:3b", False)
