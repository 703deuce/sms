"""EX-16: optional export stems zip (voice / music / sfx beds from the audio mix graph)."""
from __future__ import annotations

import json
import zipfile
from pathlib import Path

from clips_worker.audio_render import export_mix_stems


def wants_stems(deliver: dict | None) -> bool:
    return bool(deliver and deliver.get("stems"))


def capture_stems_ctx(
    *,
    video: Path,
    music_path: Path | None,
    sfx_paths: list[tuple[Path, int, float]],
    length_s: float,
    volume: float,
    duck_depth: float,
    fade_in_s: float,
    fade_out_s: float,
    music_window: dict | None = None,
    music_loop: bool = False,
    music_pan: int | None = None,
    music_pan_ch: int = 2,
    speech_volume_expr: str | None = None,
    music_volume_expr: str | None = None,
    sfx_volume_exprs: list[str | None] | None = None,
    sfx_trims: list | None = None,
    track_fx: dict | None = None,
    sfx_fx: list | None = None,
    dub_audio: Path | None = None,
) -> dict:
    return {
        "video": str(video),
        "music": str(music_path) if music_path and music_path.is_file() else None,
        "sfx": [
            {"path": str(p), "at_ms": int(at), "volume": float(vol)}
            for p, at, vol in sfx_paths
            if p.is_file()
        ],
        "length_s": float(length_s),
        "volume": float(volume),
        "duck_depth": float(duck_depth),
        "fade_in_s": float(fade_in_s),
        "fade_out_s": float(fade_out_s),
        "music_window": music_window,
        "music_loop": bool(music_loop),
        "music_pan": music_pan,
        "music_pan_ch": int(music_pan_ch or 2),
        "speech_volume_expr": speech_volume_expr,
        "music_volume_expr": music_volume_expr,
        "sfx_volume_exprs": sfx_volume_exprs,
        "sfx_trims": sfx_trims,
        "track_fx": track_fx,
        "sfx_fx": sfx_fx,
        "dub_audio": str(dub_audio) if dub_audio and dub_audio.is_file() else None,
    }


def _paths_from_ctx(ctx: dict) -> tuple[Path, Path | None, list[tuple[Path, int, float]], Path | None]:
    video = Path(ctx["video"])
    music = Path(ctx["music"]) if ctx.get("music") else None
    sfx: list[tuple[Path, int, float]] = []
    for row in ctx.get("sfx") or []:
        sfx.append((Path(row["path"]), int(row["at_ms"]), float(row["volume"])))
    dub = Path(ctx["dub_audio"]) if ctx.get("dub_audio") else None
    return video, music, sfx, dub


def pack_stems_zip(ctx: dict, work_dir: Path, zip_out: Path) -> list[str]:
    """Render per-track WAV stems and write zip_out. Returns track filenames included."""
    work_dir.mkdir(parents=True, exist_ok=True)
    stems_dir = work_dir / "stems_out"
    stems_dir.mkdir(parents=True, exist_ok=True)
    video, music, sfx_paths, dub_audio = _paths_from_ctx(ctx)
    written = export_mix_stems(
        video,
        stems_dir,
        music,
        sfx_paths,
        dub_audio=dub_audio,
        length_s=float(ctx.get("length_s") or 1.0),
        volume=float(ctx.get("volume") or 0.25),
        duck_depth=float(ctx.get("duck_depth") or 0.7),
        fade_in_s=float(ctx.get("fade_in_s") or 0.0),
        fade_out_s=float(ctx.get("fade_out_s") or 0.0),
        music_window=ctx.get("music_window"),
        music_loop=bool(ctx.get("music_loop")),
        music_pan=ctx.get("music_pan"),
        music_pan_ch=int(ctx.get("music_pan_ch") or 2),
        speech_volume_expr=ctx.get("speech_volume_expr"),
        music_volume_expr=ctx.get("music_volume_expr"),
        sfx_volume_exprs=ctx.get("sfx_volume_exprs"),
        sfx_trims=ctx.get("sfx_trims"),
        track_fx=ctx.get("track_fx"),
        sfx_fx=ctx.get("sfx_fx"),
    )
    manifest = {"version": 1, "tracks": written}
    (stems_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    with zipfile.ZipFile(zip_out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(stems_dir / "manifest.json", "manifest.json")
        for name in written:
            zf.write(stems_dir / name, name)
    return written
