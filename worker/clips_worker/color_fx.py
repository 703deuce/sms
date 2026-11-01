"""G4a frame-space color effects (sharpen → vignette → grain) as ffmpeg 5.1 filter-complex parts.

Same definitions as the preview SVG filter (components/clips/editor/color-look-defs.tsx):
  sharpen  5×5 unsharp kernel (convolution / feConvolveMatrix, divisor 2500) per RGB channel
  vignette multiply by an 8-bit radial mask (blend multiply / feComposite k1)
  grain    grain-merge of a hashed cell noise image, offset per frame (blend grainmerge / k2,k3,k4)
All run on gbrp (8-bit RGB planes) so the math is per RGB channel like the browser's sRGB filter.
"""
from __future__ import annotations

from pathlib import Path

from clips_worker.color_grade import (
    GRAIN_PAD,
    SHARPEN_DIVISOR,
    grain_cell,
    grain_cells,
    sharpen_kernel,
    spec_fx,
    vignette_mask,
)


def _write_pgm(path: Path, data, w: int, h: int) -> Path:
    path = Path(path)
    path.write_bytes(f"P5\n{w} {h}\n255\n".encode("ascii") + data.astype("uint8").tobytes())
    return path


def _q(p: Path) -> str:
    return str(p).replace("\\", "/").replace("'", "")


def fx_parts(label_in: str, label_out: str, fx: dict, w: int, h: int, work_dir: Path, tag: str,
             enable: str | None = None) -> list[str]:
    """Filter-complex parts: [label_in] → (G4b pre) → sharpen / vignette → (G4b post) → grain →
    (G4b shake) → [label_out] (gbrp)."""
    from clips_worker import fx_library as fl

    en = f":enable='{enable}'" if enable else ""
    parts: list[str] = []
    cur = label_in
    parts.append(f"[{cur}]format=gbrp[{tag}in]")
    cur = f"{tag}in"
    # G4b: blur → glow → RGB split → glitch before sharpen.
    pre, cur = fl.pre_parts(cur, fx, w, h, tag, en)
    parts += pre
    chain = f"[{cur}]format=gbrp"
    if fx.get("sharpen"):
        m = " ".join(str(v) for v in sharpen_kernel(int(fx["sharpen"])))
        rdiv = f"{1 / SHARPEN_DIVISOR:.6f}"
        chain += (f",convolution=0m='{m}':1m='{m}':2m='{m}':0rdiv={rdiv}:1rdiv={rdiv}:2rdiv={rdiv}"
                  f":0mode=square:1mode=square:2mode=square{en}")
    parts.append(f"{chain}[{tag}s]")
    cur = f"{tag}s"
    if fx.get("vignette"):
        mask = _write_pgm(Path(work_dir) / f"vig_{tag}_{int(fx['vignette'])}_{w}x{h}.pgm",
                          vignette_mask(int(fx["vignette"]), w, h), w, h)
        parts.append(f"movie='{_q(mask)}':loop=0,setpts=N/(30*TB),format=gbrp[{tag}vm]")
        parts.append(f"[{cur}][{tag}vm]blend=all_mode=multiply:shortest=1{en}[{tag}v]")
        cur = f"{tag}v"
    post, cur = fl.post_parts(cur, fx, w, h, work_dir, tag, en)
    parts += post
    if fx.get("grain"):
        c = grain_cell(h)
        gw, gh = -(-w // c), -(-h // c)
        cells = grain_cells(int(fx["grain"]), gw, gh)
        img = _write_pgm(Path(work_dir) / f"grain_{tag}_{int(fx['grain'])}_{gw}x{gh}.pgm", cells, gw + GRAIN_PAD,
                         gh + GRAIN_PAD)
        parts.append(
            f"movie='{_q(img)}':loop=0,setpts=N/(30*TB),"
            f"scale={(gw + GRAIN_PAD) * c}:{(gh + GRAIN_PAD) * c}:flags=neighbor,"
            f"crop={w}:{h}:x='mod(mod(n,8)*13,{GRAIN_PAD})*{c}':y='mod(mod(n,8)*29,{GRAIN_PAD})*{c}',"
            f"format=gbrp[{tag}gm]"
        )
        parts.append(f"[{cur}][{tag}gm]blend=all_mode=grainmerge:shortest=1{en}[{tag}g]")
        cur = f"{tag}g"
    shake, cur = fl.shake_parts(cur, fx, w, h, tag, en)
    parts += shake
    parts.append(f"[{cur}]null[{label_out}]")
    return parts


def fx_groups(windows: list[tuple[float, float, dict]]) -> list[tuple[dict, list[tuple[float, float]]]]:
    """Group (a, b, spec) windows by their fx settings → [(fx, spans)] (identity fx dropped)."""
    groups: dict[tuple, tuple[dict, list]] = {}
    for a, b, spec in windows:
        fx = spec_fx(spec)
        if not any(fx.values()):
            continue
        k = tuple(sorted(fx.items()))
        groups.setdefault(k, (fx, []))[1].append((a, b))
    return list(groups.values())


def enable_expr(spans_s: list[tuple[float, float]]) -> str:
    return "+".join(f"gte(t,{a:.4f})*lt(t,{b:.4f})" for a, b in spans_s)
