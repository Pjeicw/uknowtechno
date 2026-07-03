def test_backend_imports():
    import main
    import rag_store
    assert hasattr(main, "app")
    assert hasattr(rag_store, "DEFAULT_CONFIG")
