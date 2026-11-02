"""Load ASR keyterms from project settings or workspace export-user vocabulary (Q4)."""
from __future__ import annotations

import json
from typing import Any

MAX_ASR_KEYTERMS = 50
MAX_TERM_LEN = 60


def normalize_keyterms(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    seen: set[str] = set()
    out: list[str] = []
    for item in raw:
        term = str(item or "").strip().replace("\n", " ")
        if len(term) < 2 or len(term) > MAX_TERM_LEN:
            continue
        key = term.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(term)
        if len(out) >= MAX_ASR_KEYTERMS:
            break
    return out


def keyterms_from_vocabulary_prefs(prefs: dict | None) -> list[str]:
    if not isinstance(prefs, dict):
        return []
    vocab = prefs.get("vocabulary")
    if not isinstance(vocab, list):
        return []
    terms: list[str] = []
    seen: set[str] = set()
    for row in vocab:
        if not isinstance(row, dict):
            continue
        term = str(row.get("to") or row.get("from") or "").strip()
        if len(term) < 2 or len(term) > MAX_TERM_LEN:
            continue
        key = term.lower()
        if key in seen:
            continue
        seen.add(key)
        terms.append(term)
        if len(terms) >= MAX_ASR_KEYTERMS:
            break
    return terms


def load_workspace_asr_keyterms(conn, workspace_id: str, user_id: str) -> list[str]:
    if conn is None or not workspace_id or not user_id:
        return []
    try:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT prefs FROM clip_export_user_prefs WHERE "workspaceId" = %s AND "userId" = %s',
                (workspace_id, user_id),
            )
            row = cur.fetchone()
    except Exception:
        return []
    if not row or not row[0]:
        return []
    prefs = row[0]
    if isinstance(prefs, str):
        prefs = json.loads(prefs)
    return keyterms_from_vocabulary_prefs(prefs if isinstance(prefs, dict) else None)


def keyterms_for_project(conn, project: dict) -> list[str]:
    settings = project.get("settings") if isinstance(project.get("settings"), dict) else {}
    if isinstance(project.get("settings"), str):
        try:
            settings = json.loads(project["settings"])
        except json.JSONDecodeError:
            settings = {}
    from_settings = normalize_keyterms(settings.get("asrKeyterms") if isinstance(settings, dict) else None)
    if from_settings:
        return from_settings
    user_id = str(project.get("createdById") or "dev")
    ws = str(project.get("workspaceId") or "")
    loaded = load_workspace_asr_keyterms(conn, ws, user_id)
    return loaded
