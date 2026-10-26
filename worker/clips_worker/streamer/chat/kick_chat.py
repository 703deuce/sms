"""Kick VOD chat replay — no stable public API; degrade gracefully (S5)."""


def fetch_kick_vod_chat(_url: str | None, _external_id: str | None) -> list[dict] | None:
    """
    Kick does not expose a documented public VOD chat replay endpoint (unlike Twitch GQL).
    Live chat capture lands in S14. Returns None so analyze continues without chat signal.
    """
    return None
