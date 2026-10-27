"""S4 LLM rerank for streamer fusion candidates."""
from __future__ import annotations

from pathlib import Path

from clips_worker.picker.llm import chat_json

PROMPT_PATH = Path(__file__).resolve().parents[1] / "picker" / "prompts" / "genres" / "stream_moments.md"

SCHEMA = {
    "type": "object",
    "properties": {
        "candidates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "score": {"type": "integer"},
                    "keep": {"type": "boolean"},
                    "title": {"type": "string"},
                    "hook": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": [
                            "funny",
                            "clutch",
                            "fail",
                            "rage",
                            "wholesome",
                            "reaction",
                            "skill",
                            "story",
                            "other",
                        ],
                    },
                    "suggestedCaption": {"type": ["string", "null"]},
                    "hashtags": {"type": "array", "items": {"type": "string"}},
                    "setup_start_s": {"type": ["number", "null"]},
                    "payoff_end_s": {"type": ["number", "null"]},
                },
                "required": [
                    "id",
                    "score",
                    "keep",
                    "title",
                    "hook",
                    "category",
                    "suggestedCaption",
                    "hashtags",
                    "setup_start_s",
                    "payoff_end_s",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["candidates"],
    "additionalProperties": False,
}


def _load_prompt() -> str:
    if PROMPT_PATH.is_file():
        return PROMPT_PATH.read_text(encoding="utf-8")
    return (
        "You rank stream highlight windows. Return JSON candidates with id, score 0-100, keep, title, hook, category."
    )


def _words_excerpt(words: list[dict], start_ms: int, end_ms: int, pad_ms: int = 10_000) -> str:
    lo = (start_ms - pad_ms) / 1000.0
    hi = (end_ms + pad_ms) / 1000.0
    parts: list[str] = []
    for w in words:
        s = float(w.get("s", 0))
        if lo <= s <= hi:
            parts.append(str(w.get("w") or ""))
    return " ".join(parts).strip()[:4000]


def _rank_batch_gemini(
    batch: list[dict],
    words: list[dict],
    signals: dict,
    *,
    video_moments: list[dict] | None = None,
    chat_messages: list[dict] | None = None,
    viewer_clips: list[dict] | None = None,
    cue_events: list[dict] | None = None,
    range_start_ms: int = 0,
) -> list[dict]:
    import os

    if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_GEMINI_API_KEY")):
        raise RuntimeError("gemini not configured")
    import requests
    from clips_worker.gemini_vision import GEMINI_BASE, discover_model, _key

    from clips_worker.streamer.llm_rank_context import format_stream_rank_batch

    system = _load_prompt()
    user = format_stream_rank_batch(
        batch,
        words,
        signals,
        words_excerpt_fn=_words_excerpt,
        video_moments=video_moments,
        chat_messages=chat_messages,
        viewer_clips=viewer_clips,
        cue_events=cue_events,
        range_start_ms=range_start_ms,
    )
    model = discover_model()
    res = requests.post(
        f"{GEMINI_BASE}/models/{model}:generateContent",
        params={"key": _key()},
        json={
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseSchema": SCHEMA},
        },
        timeout=120,
    )
    if not res.ok:
        from clips_worker.picker.picker_errors import gemini_error_log_fields, log_picker_error

        summary, quota = gemini_error_log_fields(res.text or "")
        log_picker_error("gemini", summary or "gemini rank failed", res.status_code, quota=quota or None)
        raise RuntimeError(summary or res.text[:400])
    data = res.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    import json

    parsed = json.loads(text)
    return list(parsed.get("candidates") or [])


def rank_candidates_batch(
    batch: list[dict],
    words: list[dict],
    signals: dict,
    *,
    video_moments: list[dict] | None = None,
    chat_messages: list[dict] | None = None,
    viewer_clips: list[dict] | None = None,
    cue_events: list[dict] | None = None,
    range_start_ms: int = 0,
) -> list[dict]:
    from clips_worker.streamer.llm_rank_context import format_stream_rank_batch

    system = _load_prompt()
    user = format_stream_rank_batch(
        batch,
        words,
        signals,
        words_excerpt_fn=_words_excerpt,
        video_moments=video_moments,
        chat_messages=chat_messages,
        viewer_clips=viewer_clips,
        cue_events=cue_events,
        range_start_ms=range_start_ms,
    )
    from clips_worker.picker.picker_errors import log_picker_error

    try:
        data = chat_json(system, user, SCHEMA, "stream_moments")
        return list(data.get("candidates") or [])
    except Exception as openai_err:
        log_picker_error("openai", str(openai_err)[:300], None)
        print("[clipper:stream] llm_rank openai_failed trying=gemini", flush=True)
        try:
            return _rank_batch_gemini(
                batch,
                words,
                signals,
                video_moments=video_moments,
                chat_messages=chat_messages,
                viewer_clips=viewer_clips,
                cue_events=cue_events,
                range_start_ms=range_start_ms,
            )
        except Exception as gemini_err:
            log_picker_error("gemini", str(gemini_err)[:300], None)
            raise RuntimeError("stream llm_rank failed after openai and gemini") from gemini_err


def make_llm_ranker(
    words: list[dict],
    *,
    video_moments: list[dict] | None = None,
    chat_messages: list[dict] | None = None,
    viewer_clips: list[dict] | None = None,
    cue_events: list[dict] | None = None,
    range_start_ms: int = 0,
):
    def _ranker(candidates: list[dict], _words: list[dict], _signals: dict) -> list[dict]:
        out: list[dict] = []
        batch_size = 10
        for i in range(0, len(candidates), batch_size):
            chunk = candidates[i : i + batch_size]
            out.extend(
                rank_candidates_batch(
                    chunk,
                    words,
                    _signals,
                    video_moments=video_moments,
                    chat_messages=chat_messages,
                    viewer_clips=viewer_clips,
                    cue_events=cue_events,
                    range_start_ms=range_start_ms,
                )
            )
        return out

    return _ranker
