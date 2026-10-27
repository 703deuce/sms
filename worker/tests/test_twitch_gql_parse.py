import os

from clips_worker.streamer.chat.twitch_gql import (
    DEFAULT_GQL_CLIENT_ID,
    _extract_page,
    _parse_comment,
    comments_persisted_hash,
    gql_client_id,
)


def test_gql_client_id_only_env_override():
    os.environ.pop("TWITCH_CLIENT_ID", None)
    os.environ.pop("TWITCH_HELIX_CLIENT_ID", None)
    os.environ.pop("TWITCH_GQL_CLIENT_ID", None)
    assert gql_client_id() == DEFAULT_GQL_CLIENT_ID
    os.environ["TWITCH_GQL_CLIENT_ID"] = "custom"
    assert gql_client_id() == "custom"
    os.environ["TWITCH_CLIENT_ID"] = "helix-should-not-use"
    assert gql_client_id() == "custom"
    os.environ.pop("TWITCH_GQL_CLIENT_ID", None)


def test_parse_comment_user_color_on_message():
    node = {
        "contentOffsetSeconds": 3,
        "commenter": {"login": "viewer1"},
        "message": {"userColor": "#ff00aa", "fragments": [{"text": "yo"}]},
    }
    row = _parse_comment(node)
    assert row["color"] == "#ff00aa"


def test_extract_page_cursor_from_last_edge():
    data = {
        "data": {
            "video": {
                "comments": {
                    "edges": [
                        {
                            "cursor": "c1",
                            "node": {
                                "contentOffsetSeconds": 1,
                                "commenter": {"login": "a"},
                                "message": {"fragments": [{"text": "x"}]},
                            },
                        },
                        {
                            "cursor": "c2",
                            "node": {
                                "contentOffsetSeconds": 2,
                                "commenter": {"login": "b"},
                                "message": {"fragments": [{"text": "y"}]},
                            },
                        },
                    ],
                    "pageInfo": {"hasNextPage": True, "endCursor": "ignored"},
                }
            }
        }
    }
    msgs, cursor, has_next = _extract_page(data)
    assert len(msgs) == 2
    assert cursor == "c2"
    assert has_next is True


def test_comments_hash_default():
    assert len(comments_persisted_hash()) == 64
