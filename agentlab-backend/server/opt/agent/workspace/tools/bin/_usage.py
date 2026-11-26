#!/usr/bin/env python3
"""Shared usage logging for Agent Lab media CLIs. Never logs secrets."""
import json, os
from datetime import datetime
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")

# Nano Banana 2.1 (gemini-nano-banana-2.1) standard rates, Gemini API 2026-10.
IMAGE_INPUT_PER_TOKEN = 1.50 / 1_000_000
IMAGE_TEXT_OUT_PER_TOKEN = 7.50 / 1_000_000
IMAGE_OUT_PER_TOKEN = 30.00 / 1_000_000
IMAGE_TOKENS_BY_SIZE = {"1K": 1120, "2K": 1680, "4K": 3780}

# ElevenLabs Flash v2.5 list price.
TTS_PER_CHAR = 0.04 / 1000

# Deepgram Nova-3 pre-recorded monolingual; diarization included.
TRANSCRIBE_PER_MINUTE = 0.0043


def workspace_root():
    env = os.environ.get("AGENT_WORKSPACE")
    if env:
        return env
    if os.path.isdir("/workspace"):
        return "/workspace"
    return "/opt/agent/workspace"


def usage_dir():
    d = os.path.join(workspace_root(), "usage")
    os.makedirs(d, mode=0o775, exist_ok=True)
    try:
        os.chmod(d, 0o775)
    except OSError:
        pass
    return d


def usage_log_path():
    return os.environ.get("USAGE_LOG") or os.path.join(usage_dir(), "usage.jsonl")


def now_iso():
    return datetime.now(ET).isoformat(timespec="seconds")


def append_usage(tool, units, estimated_cost_usd, **extra):
    rec = {
        "ts": now_iso(),
        "tool": tool,
        "units": units or {},
        "estimated_cost_usd": round(float(estimated_cost_usd or 0), 6),
    }
    cid = extra.pop("conversation_id", None) or os.environ.get("CONVERSATION_ID") or os.environ.get("OH_CONVERSATION_ID")
    job = extra.pop("job", None) or os.environ.get("USAGE_JOB")
    if not cid:
        cid, jdir = _job_from_paths([os.getcwd(), extra.get("out"), extra.get("source")])
        job = job or jdir
    if cid:
        rec["conversation_id"] = cid
    if job:
        rec["job"] = job
    for k, v in extra.items():
        if v is not None:
            rec[k] = v
    path = usage_log_path()
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return rec


def _job_from_paths(paths):
    """(conversation_id, job_dir) from the first path inside /workspace/jobs/<id>[/helpers/<id>]..."""
    import re
    uuid = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    for p in paths:
        if not p:
            continue
        p = os.path.abspath(str(p))
        m = re.match(rf"^(/workspace/jobs/{uuid}(?:/helpers/{uuid})*)", p)
        if m:
            d = m.group(1)
            return d.rsplit("/", 1)[-1], d
    return None, None


def image_cost_from_usage(usage_meta, size="1K"):
    """Estimate USD from a google-genai usage_metadata object or dict."""
    um = _as_dict(usage_meta) if usage_meta is not None else {}
    prompt = int(um.get("prompt_token_count") or um.get("promptTokenCount") or 0)
    thoughts = int(um.get("thoughts_token_count") or um.get("thoughtsTokenCount") or 0)
    candidates = int(um.get("candidates_token_count") or um.get("candidatesTokenCount") or 0)
    image_tokens = 0
    text_out = 0
    details = um.get("candidates_tokens_details") or um.get("candidatesTokensDetails") or []
    for d in details:
        dd = _as_dict(d)
        modality = str(dd.get("modality") or "").upper()
        n = int(dd.get("token_count") or dd.get("tokenCount") or 0)
        if modality == "IMAGE":
            image_tokens += n
        else:
            text_out += n
    if not image_tokens and not text_out and not thoughts:
        # fall back: treat remaining candidate tokens as image if we expected one
        image_tokens = IMAGE_TOKENS_BY_SIZE.get(str(size).upper(), 1120)
        text_out = 0
    elif not image_tokens:
        # details missing; residual candidate tokens after thoughts are likely the image
        residual = max(0, candidates - thoughts)
        if residual:
            image_tokens = residual
            text_out = 0
        else:
            image_tokens = IMAGE_TOKENS_BY_SIZE.get(str(size).upper(), 1120)
    else:
        # if details split image vs text, keep text_out; thoughts billed as text output
        pass
    text_out_tokens = text_out + thoughts
    cost = (prompt * IMAGE_INPUT_PER_TOKEN
            + text_out_tokens * IMAGE_TEXT_OUT_PER_TOKEN
            + image_tokens * IMAGE_OUT_PER_TOKEN)
    return cost, {
        "prompt_tokens": prompt,
        "thoughts_tokens": thoughts,
        "text_output_tokens": text_out,
        "image_output_tokens": image_tokens,
        "size": size,
        "images": 1,
    }


def tts_cost(characters):
    n = int(characters or 0)
    return n * TTS_PER_CHAR, {"characters": n}


def transcribe_cost(duration_seconds):
    mins = max(0.0, float(duration_seconds or 0)) / 60.0
    return mins * TRANSCRIBE_PER_MINUTE, {"seconds": round(float(duration_seconds or 0), 3), "minutes": round(mins, 4)}


def _as_dict(obj):
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    for name in ("model_dump", "to_dict", "dict"):
        fn = getattr(obj, name, None)
        if callable(fn):
            try:
                return fn() if name != "model_dump" else fn(mode="python", exclude_none=False)
            except TypeError:
                try:
                    return fn()
                except Exception:
                    pass
            except Exception:
                pass
    out = {}
    for k in dir(obj):
        if k.startswith("_"):
            continue
        try:
            v = getattr(obj, k)
        except Exception:
            continue
        if callable(v):
            continue
        out[k] = v
    return out
