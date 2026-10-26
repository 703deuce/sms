from clips_worker.streamer.chat.twitch_gql import _extract_page, _parse_comment


def test_parse_comment_tolerates_missing_fields():
    node = {
        "contentOffsetSeconds": 42,
        "commenter": {"login": "viewer1", "color": "#fff"},
        "message": {"fragments": [{"text": "hello "}, {"text": "chat"}]},
    }
    row = _parse_comment(node)
    assert row["t_s"] == 42
    assert row["user"] == "viewer1"
    assert "hello chat" in row["text"]


def test_extract_page_cursor():
    data = {
        "data": {
            "video": {
                "comments": {
                    "edges": [{"node": {"contentOffsetSeconds": 1, "commenter": {"login": "a"}, "message": {"fragments": [{"text": "x"}]}}}],
                    "pageInfo": {"endCursor": "abc"},
                }
            }
        }
    }
    msgs, cursor = _extract_page(data)
    assert len(msgs) == 1
    assert cursor == "abc"
