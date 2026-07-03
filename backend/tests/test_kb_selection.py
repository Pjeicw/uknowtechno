import main


def test_parse_none_and_empty():
    assert main.parse_kb_selection(None) == []
    assert main.parse_kb_selection("") == []
    assert main.parse_kb_selection("none") == []


def test_parse_comma_string():
    assert main.parse_kb_selection("portfolio,website_public") == ["portfolio", "website_public"]


def test_parse_list_and_trim():
    assert main.parse_kb_selection([" alpha ", "none", "beta"]) == ["alpha", "beta"]
