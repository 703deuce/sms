"""Shared Gemini Nano Banana image generate/edit helper."""
import base64, io, mimetypes, os, sys
from pathlib import Path

from google import genai
from google.genai import types

DEFAULT_MODEL = os.environ.get("IMAGE_GEN_MODEL", "gemini-nano-banana-2.1")
IMG_EXT = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}


def die(msg, name="image-gen"):
    print(f"{name}: {msg}", file=sys.stderr)
    sys.exit(1)


def load_part(path):
    mime = mimetypes.guess_type(path)[0] or "image/png"
    with open(path, "rb") as f:
        return types.Part.from_bytes(data=f.read(), mime_type=mime)


EST_USD = {"1K": 0.04, "2K": 0.14, "4K": 0.24}  # list-price estimate per image (cap check only; real cost is logged)


def cost_guard(size, tool):
    """Off switch + per-call cost cap (2026-11-25 core8). IMAGE_MAX_USD (default 0.15) blocks pricier calls."""
    if os.path.exists("/opt/tools/flags/IMAGE_GEN_OFF"):
        die("image generation is switched off (flag IMAGE_GEN_OFF)", tool)
    cap = float(os.environ.get("IMAGE_MAX_USD", "0.15"))
    est = EST_USD.get(str(size).upper(), 0.24)
    if est > cap:
        die(f"size {size} is about ${est:.2f} per image, over the ${cap:.2f} per-call cap. Use --size 1K (or 2K), "
            "or ask Rick to raise IMAGE_MAX_USD.", tool)


def generate(prompt, refs, out, size="1K", aspect="1:1", model=DEFAULT_MODEL, tool="image-gen"):
    cost_guard(size, tool)
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        die("GEMINI_API_KEY not set", tool)
    if not prompt:
        die("prompt is required", tool)
    out = str(out)
    Path(os.path.dirname(out) or ".").mkdir(parents=True, exist_ok=True)
    parts = [load_part(r) for r in refs]
    parts.append(types.Part.from_text(text=prompt))
    client = genai.Client(api_key=key)
    cfg = types.GenerateContentConfig(
        response_modalities=["IMAGE", "TEXT"],
        image_config=types.ImageConfig(aspect_ratio=aspect, image_size=size),
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.MINIMAL),
    )
    try:
        resp = client.models.generate_content(
            model=model,
            contents=parts,
            config=cfg,
        )
    except Exception as e:
        die(f"Gemini request failed: {e}", tool)
    text, saved = _save_first_image(resp, out, tool)
    from _usage import append_usage, image_cost_from_usage
    cost, units = image_cost_from_usage(getattr(resp, "usage_metadata", None), size=size)
    units["refs"] = len(refs)
    rec = append_usage(tool, units, cost, model=model, out=out, aspect=aspect)
    msg = f"wrote {out}  estimated ${rec['estimated_cost_usd']:.4f}  ({size}, model {model})"
    if text:
        msg += f"\n{text}"
    print(msg)
    return rec


def _save_first_image(resp, out, tool):
    cands = list(getattr(resp, "candidates", None) or [])
    if not cands:
        fb = getattr(resp, "prompt_feedback", None)
        die(f"no candidates in response{(': ' + str(fb)) if fb else ''}", tool)
    text_bits = []
    saved = False
    content = getattr(cands[0], "content", None)
    parts = list(getattr(content, "parts", None) or [])
    for part in parts:
        t = getattr(part, "text", None)
        if t:
            text_bits.append(t)
        inline = getattr(part, "inline_data", None) or getattr(part, "inlineData", None)
        if not inline:
            continue
        data = getattr(inline, "data", None)
        if data is None and isinstance(inline, dict):
            data = inline.get("data")
        if data is None:
            continue
        if isinstance(data, str):
            data = base64.b64decode(data)
        _write_image_bytes(data, out)
        saved = True
        break
    if not saved:
        die("no image in response" + (": " + " ".join(text_bits)[:500] if text_bits else ""), tool)
    return " ".join(text_bits).strip(), saved


def _write_image_bytes(data, out):
    ext = os.path.splitext(out)[1].lower()
    fmt = IMG_EXT.get(ext)
    if not fmt:
        with open(out, "wb") as f:
            f.write(data)
        return
    from PIL import Image
    im = Image.open(io.BytesIO(data))
    if fmt == "JPEG" and im.mode in ("RGBA", "P", "LA"):
        im = im.convert("RGB")
    im.save(out, fmt)
