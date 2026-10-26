"""Twitch GQL VOD comment replay (S5)."""
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

GQL_URL = "https://gql.twitch.tv/gql"
MAX_MESSAGES = int(os.environ.get("STREAMER_CHAT_MAX_MESSAGES", "300000"))


def _headers() -> dict[str, str]:
    return {
        "Client-Id": os.environ["TWITCH_GQL_CLIENT_ID"],
        "Content-Type": "application/json",
    }


def _parse_comment(node: dict) -> dict | None:
    try:
        t = int(node.get("contentOffsetSeconds", node.get("content_offset_seconds", 0)))
    except (TypeError, ValueError):
        return None
    commenter = node.get("commenter") or {}
    user = commenter.get("login") or commenter.get("displayName") or ""
    color = commenter.get("color")
    fragments = node.get("message", {}).get("fragments") or node.get("fragments") or []
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


def _extract_page(data: Any) -> tuple[list[dict], str | None]:
    messages: list[dict] = []
    cursor: str | None = None
    if not isinstance(data, dict):
        return messages, cursor
    video = data.get("data", {}).get("video", {}) if "data" in data else data.get("video", {})
    comments = video.get("comments") or {}
    edges = comments.get("edges") or comments.get("nodes") or []
    for edge in edges:
        node = edge.get("node") if isinstance(edge, dict) else edge
        if not isinstance(node, dict):
            continue
        parsed = _parse_comment(node)
        if parsed:
            messages.append(parsed)
    page_info = comments.get("pageInfo") or {}
    cursor = page_info.get("endCursor") or comments.get("cursor")
    return messages, cursor


def fetch_vod_comments(video_id: str, cursor: str | None = None) -> tuple[list[dict], str | None]:
    """Fetch one page of VOD comments (caller loops for full replay)."""
    if not os.environ.get("TWITCH_GQL_CLIENT_ID") or not os.environ.get("TWITCH_GQL_COMMENTS_HASH"):
        return [], None
    persisted = os.environ["TWITCH_GQL_COMMENTS_HASH"]
    variables: dict[str, Any] = {"videoID": video_id}
    if cursor:
        variables["cursor"] = cursor
    else:
        variables["contentOffsetSeconds"] = 0
    body = [{"operationName": "VideoCommentsByOffsetOrCursor", "variables": variables, "extensions": {"persistedQuery": {"version": 1, "sha256Hash": persisted}}}]
    backoff = 1.0
    for attempt in range(6):
        try:
            time.sleep(0.25 + random.random() * 0.05)
            req = urllib.request.Request(
                GQL_URL,
                data=json.dumps(body).encode("utf-8"),
                headers={**_headers(), "Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    status = resp.status
                    raw = resp.read()
            except urllib.error.HTTPError as e:
                status = e.code
                raw = e.read()
            if status == 429:
                time.sleep(backoff)
                backoff *= 2
                continue
            if status >= 400:
                raise RuntimeError(f"gql http {status}")
            payload = json.loads(raw.decode("utf-8"))
            if isinstance(payload, list) and payload:
                payload = payload[0]
            return _extract_page(payload)
        except Exception:
            time.sleep(backoff)
            backoff *= 2
    return [], cursor


def fetch_all_vod_comments(video_id: str, start_cursor: str | None = None) -> tuple[list[dict], str | None]:
    out: list[dict] = []
    cursor = start_cursor
    while len(out) < MAX_MESSAGES:
        batch, cursor = fetch_vod_comments(video_id, cursor)
        if not batch:
            break
        out.extend(batch)
        if not cursor:
            break
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
