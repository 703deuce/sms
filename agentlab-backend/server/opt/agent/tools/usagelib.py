"""Meter Gemini calls made by look/search into /workspace/usage/usage.jsonl (via Track B's _usage.py). Never logs secrets."""
import os, sys

# Gemini Flash list prices (USD per token) and Google Search grounding per request; estimates.
FLASH_IN, FLASH_OUT, GROUNDING = 0.30 / 1e6, 2.50 / 1e6, 0.035
FLASH_AUDIO_IN = 1.00 / 1e6  # audio input tokens are billed higher


def log_gemini(tool, model, usage, grounded=False, **extra):
    try:
        um = usage or {}
        p = int(um.get('promptTokenCount') or 0)
        o = int(um.get('candidatesTokenCount') or 0) + int(um.get('thoughtsTokenCount') or 0)
        audio = sum(int(d.get('tokenCount') or 0) for d in (um.get('promptTokensDetails') or []) if d.get('modality') == 'AUDIO')
        cost = (p - audio) * FLASH_IN + audio * FLASH_AUDIO_IN + o * FLASH_OUT + (GROUNDING if grounded else 0)
        sys.path.insert(0, '/workspace/tools/bin')
        import _usage
        _usage.append_usage(tool, {'prompt_tokens': p, 'audio_tokens': audio, 'output_tokens': o, 'grounded': grounded}, cost, model=model, **extra)
    except Exception:
        pass  # metering must never break the tool


def _deepseek_flash_rates(now=None):
    """deepseek-flash USD/token (cache-hit in, cache-miss in, out). Peak 01-04 & 06-10 UTC Mon-Fri; off-peak is half."""
    import datetime
    t = now or datetime.datetime.now(datetime.timezone.utc)
    peak = t.weekday() < 5 and (1 <= t.hour < 4 or 6 <= t.hour < 10)
    m = 1.0 if peak else 0.5
    return 0.006e-6 * m, 0.30e-6 * m, 1.20e-6 * m, peak


def log_deepseek(tool, model, usage, **extra):
    try:
        um = usage or {}
        hit = int(um.get('prompt_cache_hit_tokens') or 0)
        p = int(um.get('prompt_tokens') or 0)
        miss = int(um.get('prompt_cache_miss_tokens') or max(0, p - hit))
        o = int(um.get('completion_tokens') or 0)
        r_hit, r_miss, r_out, peak = _deepseek_flash_rates()
        cost = hit * r_hit + miss * r_miss + o * r_out
        sys.path.insert(0, '/workspace/tools/bin')
        import _usage
        _usage.append_usage(tool, {'prompt_tokens': p, 'cache_hit_tokens': hit, 'output_tokens': o, 'peak': peak},
                            cost, model=model, provider='deepseek', **extra)
    except Exception:
        pass
