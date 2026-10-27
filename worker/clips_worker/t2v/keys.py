"""T2V storage key helpers (no storage driver imports)."""

VOICE_KEY_PREFIX = "t2v/voice/"


def voice_storage_key(voice_hash: str) -> str:
    return f"{VOICE_KEY_PREFIX}{voice_hash}.mp3"
