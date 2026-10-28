"""Twitch GQL VOD comment replay (S5) — persisted query + public GQL client id."""
from __future__ import annotations

import gzip
import json
import os
import random
import time
from pathlib import Path
from typing import Any

import urllib.error
import urllib.request

from clips_worker.streamer.errors import RetryableError

GQL_URL = "https://gql.twitch.tv/gql"
MAX_MESSAGES = int(os.environ.get("STREAMER_CHAT_MAX_MESSAGES", "300000"))
DEFAULT_CHAT_FETCH_BUDGET_S = float(os.environ.get("STREAMER_CHAT_FETCH_BUDGET_S", "90"))

# Twitch web GQL client (override only via TWITCH_GQL_CLIENT_ID — never TWITCH_CLIENT_ID).
DEFAULT_GQL_CLIENT_ID = "kd1unb4b3q4t58fwlpcbzcbnm76a8fp"
# TwitchDownloader persisted query hash (override via TWITCH_GQL_COMMENTS_HASH).
DEFAULT_COMMENTS_HASH = "b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a"


class TwitchChatReplayError(RuntimeError):
    """VOD chat replay failed with a non-retryable error."""


class ChatFetchBudgetExceeded(TwitchChatReplayError):
    """VOD chat replay stopped: time budget exhausted (non-fatal for analyze)."""


def gql_client_id() -> str:
    raw = (os.environ.get("TWITCH_GQL_CLIENT_ID") or "").strip()
    return raw or DEFAULT_GQL_CLIENT_ID


def comments_persisted_hash() -> str:
    raw = (os.environ.get("TWITCH_GQL_COMMENTS_HASH") or "").strip()
    return raw or DEFAULT_COMMENTS_HASH


def _headers() -> dict[str, str]:
    return {
        "Client-Id": gql_client_id(),
        "Content-Type": "application/json",
    }


def _parse_comment(node: dict) -> dict | None:
    try:
        t = int(node.get("contentOffsetSeconds", node.get("content_offset_seconds", 0)))
    except (TypeError, ValueError):
        return None
    commenter = node.get("commenter") or {}
    user = commenter.get("login") or commenter.get("displayName") or ""
    message = node.get("message") or {}
    color = message.get("userColor") or commenter.get("color")
    fragments = message.get("fragments") or node.get("fragments") or []
    parts: list[str] = []
    for frag in fragments:
        if isinstance(frag, dict):
            parts.append(str(frag.get("text") or frag.get("content") or ""))
        else:
            parts.append(str(frag))
    text = "".join(parts).strip()
    if not text:
        return None
    return {"t_s": t, "user": user, "color": color, "text": text}


def _extract_page(data: Any) -> tuple[list[dict], str | None, bool]:
    messages: list[dict] = []
    cursor: str | None = None
    has_next = False
    if not isinstance(data, dict):
        return messages, cursor, has_next
    if data.get("errors"):
        err = data["errors"][0] if isinstance(data["errors"], list) else data["errors"]
        msg = err.get("message") if isinstance(err, dict) else str(err)
        raise TwitchChatReplayError(f"gql errors: {msg}")
    video = data.get("data", {}).get("video", {}) if "data" in data else data.get("video", {})
    if not video:
        raise TwitchChatReplayError("gql missing video payload")
    comments = video.get("comments") or {}
    edges = comments.get("edges")
    if edges is None:
        raise RetryableError("gql comments edges missing (transient)")
    page_info = comments.get("pageInfo") or {}
    has_next = bool(page_info.get("hasNextPage"))
    for edge in edges:
        node = edge.get("node") if isinstance(edge, dict) else edge
        if not isinstance(node, dict):
            continue
        parsed = _parse_comment(node)
        if parsed:
            messages.append(parsed)
    if has_next and edges:
        last = edges[-1]
        if isinstance(last, dict):
            cursor = last.get("cursor")
    return messages, cursor, has_next


def _gql_errors_text(payload: Any) -> str | None:
    if isinstance(payload, list) and payload:
        payload = payload[0]
    if not isinstance(payload, dict):
        return None
    errs = payload.get("errors")
    if not errs:
        return None
    first = errs[0] if isinstance(errs, list) else errs
    return first.get("message") if isinstance(first, dict) else str(first)


def fetch_vod_comments(
    video_id: str,
    cursor: str | None = None,
    *,
    content_offset_seconds: int = 0,
) -> tuple[list[dict], str | None, bool]:
    """Fetch one page of VOD comments."""
    variables: dict[str, Any] = {"videoID": video_id}
    if cursor:
        variables["cursor"] = cursor
    else:
        variables["contentOffsetSeconds"] = max(0, int(content_offset_seconds))
    body = [
        {
            "operationName": "VideoCommentsByOffsetOrCursor",
            "variables": variables,
            "extensions": {
                "persistedQuery": {"version": 1, "sha256Hash": comments_persisted_hash()},
            },
        }
    ]
    backoff = 1.0
    last_err: Exception | None = None
    for attempt in range(10):
        try:
            time.sleep(0.25 + random.random() * 0.05)
            req = urllib.request.Request(
                GQL_URL,
                data=json.dumps(body).encode("utf-8"),
                headers=_headers(),
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    status = resp.status
                    raw = resp.read()
            except urllib.error.HTTPError as e:
                status = e.code
                raw = e.read()
            if status == 429 or status >= 500:
                last_err = RetryableError(f"gql http {status}")
                time.sleep(backoff)
                backoff = min(backoff * 2, 60.0)
                continue
            if status >= 400:
                snippet = raw.decode("utf-8", errors="replace")[:300]
                raise TwitchChatReplayError(f"gql http {status}: {snippet}")
            payload = json.loads(raw.decode("utf-8"))
            err_msg = _gql_errors_text(payload)
            if err_msg:
                raise TwitchChatReplayError(err_msg)
            if isinstance(payload, list) and payload:
                payload = payload[0]
            return _extract_page(payload)
        except RetryableError as exc:
            last_err = exc
            time.sleep(backoff)
            backoff = min(backoff * 2, 60.0)
        except TwitchChatReplayError:
            raise
        except Exception as exc:
            last_err = RetryableError(str(exc))
            time.sleep(backoff)
            backoff = min(backoff * 2, 60.0)
    if isinstance(last_err, RetryableError):
        raise last_err
    raise TwitchChatReplayError(f"gql fetch failed after retries: {last_err}")


def fetch_all_vod_comments(
    video_id: str,
    start_cursor: str | None = None,
    *,
    content_offset_seconds: int = 0,
    stop_after_seconds: int | None = None,
    time_budget_s: float | None = None,
) -> tuple[list[dict], str | None]:
    """Page VOD chat replay; optional offset/stop window and hard wall-clock budget."""
    budget = DEFAULT_CHAT_FETCH_BUDGET_S if time_budget_s is None else float(time_budget_s)
    deadline = time.monotonic() + max(5.0, budget)
    stop_after = stop_after_seconds
    offset_s = max(0, int(content_offset_seconds))
    out: list[dict] = []
    cursor = start_cursor
    has_next = True
    first_page = cursor is None
    budget_hit = False

    while len(out) < MAX_MESSAGES and has_next:
        if time.monotonic() >= deadline:
            budget_hit = True
            break
        page_offset = offset_s if first_page and not cursor else 0
        batch, cursor, has_next = fetch_vod_comments(
            video_id,
            cursor,
            content_offset_seconds=page_offset,
        )
        first_page = False
        if stop_after is not None:
            for row in batch:
                t = int(row.get("t_s", 0))
                if t > stop_after:
                    has_next = False
                    break
                if t >= offset_s:
                    out.append(row)
        else:
            out.extend(batch)
        if not has_next:
            break
        if not cursor:
            break

    if budget_hit:
        print(
            f"[clipper:chat] WARNING chat_fetch_budget_exceeded videoId={video_id} "
            f"budget_s={budget:.0f} offset_s={offset_s} stop_after_s={stop_after} "
            f"messages={len(out)} — continuing analyze without chat signals",
            flush=True,
        )
        if out:
            return out[:MAX_MESSAGES], cursor
        raise ChatFetchBudgetExceeded(
            f"chat fetch budget {budget:.0f}s exceeded (offset={offset_s}s stop={stop_after})"
        )

    return out[:MAX_MESSAGES], cursor


def save_jsonl_gz(path: Path, messages: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8") as f:
        for row in messages:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def load_jsonl_gz(path: Path) -> list[dict]:
    out: list[dict] = []
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out
