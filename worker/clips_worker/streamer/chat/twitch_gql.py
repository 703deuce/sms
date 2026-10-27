"""Twitch GQL VOD comment replay (S5) — public web client id + full query body."""
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

# Public web client id (Twitch web app); override with TWITCH_GQL_CLIENT_ID if needed.
DEFAULT_GQL_CLIENT_ID = "kimne78kx3bnxbr9go8qwyt2"

VIDEO_COMMENTS_BY_OFFSET_QUERY = """
query VideoCommentsByOffsetOrCursor($videoID: ID!, $contentOffsetSeconds: Float, $cursor: Cursor) {
  video(id: $videoID) {
    comments(contentOffsetSeconds: $contentOffsetSeconds, cursor: $cursor) {
      edges {
        cursor
        node {
          contentOffsetSeconds
          commenter {
            login
            displayName
            color
          }
          message {
            fragments {
              text
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
""".strip()


class TwitchChatReplayError(RuntimeError):
    """VOD chat replay failed; carries message for job logs."""


def gql_client_id() -> str:
    return (
        os.environ.get("TWITCH_GQL_CLIENT_ID")
        or os.environ.get("TWITCH_CLIENT_ID")
        or os.environ.get("TWITCH_HELIX_CLIENT_ID")
        or DEFAULT_GQL_CLIENT_ID
    ).strip()


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
    if data.get("errors"):
        err = data["errors"][0] if isinstance(data["errors"], list) else data["errors"]
        msg = err.get("message") if isinstance(err, dict) else str(err)
        raise TwitchChatReplayError(f"gql errors: {msg}")
    video = data.get("data", {}).get("video", {}) if "data" in data else data.get("video", {})
    if not video:
        raise TwitchChatReplayError("gql missing video payload")
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


def fetch_vod_comments(video_id: str, cursor: str | None = None) -> tuple[list[dict], str | None]:
    """Fetch one page of VOD comments. Raises TwitchChatReplayError on failure."""
    variables: dict[str, Any] = {"videoID": video_id}
    if cursor:
        variables["cursor"] = cursor
    else:
        variables["contentOffsetSeconds"] = 0
    body = [
        {
            "operationName": "VideoCommentsByOffsetOrCursor",
            "query": VIDEO_COMMENTS_BY_OFFSET_QUERY,
            "variables": variables,
        }
    ]
    backoff = 1.0
    last_err: Exception | None = None
    for attempt in range(6):
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
            if status == 429:
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
        except TwitchChatReplayError:
            raise
        except Exception as exc:
            last_err = exc
            time.sleep(backoff)
            backoff = min(backoff * 2, 60.0)
    raise TwitchChatReplayError(f"gql fetch failed after retries: {last_err}")


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
