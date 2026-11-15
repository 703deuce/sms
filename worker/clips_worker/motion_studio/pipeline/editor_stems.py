"""FE-6 / BE-9: stems for the Compact Editor hookup.

The Compact Editor clip of a Motion Studio project used to get the finished master (picture + full mix) as its
canvas, so music could not be touched in the editor and scenes were one undivided item. DOC_ASSEMBLE now also
writes:

* ``canvas.mp4``  picture + the DIALOG mix (narration + footage sound + SFX). Narration stays in the canvas so
  transcript cuts, scene deletes and captions keep picture and voice in sync.
* ``music.m4a``   the score / uploaded music on its own (pre-duck). The editor puts it on its Music lane and ducks
  it under the voice itself (volume, fades, swap or remove all work there).

Both get the same gain, measured so that dialog + ducked music lands on the house loudness (-15 LUFS), i.e. the
editor's default playback matches the Motion Studio master. Never raises into the caller: on any failure the
caller keeps the old behaviour (master as canvas, no music item) and logs a warning.
"""
from __future__ import annotations

import math
import os
import subprocess

from clips_worker.motion_studio.core import audio as A
from clips_worker.motion_studio.core.world import HOUSE

FMT = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo"


def _run(args: list[str]) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def dialog_pre(out_wav: str, total: float, vo: str | None, sfx: str | None, clips: list[str],
               sfx_gain_db: float = -8.0) -> str | None:
    """Narration + SFX + footage-audio stems at the same relative gains as ``audio.mix`` (no loudnorm)."""
    ins, chains, labels = [], [], []

    def add(p: str) -> int:
        ins.extend(["-i", p])
        return len(ins) // 2 - 1
    if vo:
        k = add(vo)
        chains.append(f"[{k}:a]{FMT},apad,atrim=0:{total:.4f}[vo]")
        labels.append("[vo]")
    if sfx:
        k = add(sfx)
        chains.append(f"[{k}:a]{FMT},volume={sfx_gain_db}dB,apad,atrim=0:{total:.4f}[sx]")
        labels.append("[sx]")
    for j, c in enumerate(clips or []):
        k = add(c)
        chains.append(f"[{k}:a]{FMT},apad,atrim=0:{total:.4f}[cl{j}]")
        labels.append(f"[cl{j}]")
    if not labels:
        return None
    chains.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,atrim=0:{total:.4f}[d]")
    _run([*ins, "-filter_complex", ";".join(chains), "-map", "[d]", "-c:a", "pcm_s24le", out_wav])
    return out_wav


def music_pre(out_wav: str, total: float, music: str, music_gain_db: float = -9.0) -> str:
    _run(["-i", music, "-af", f"{FMT},volume={music_gain_db}dB,apad,atrim=0:{total:.4f}", "-c:a", "pcm_s24le", out_wav])
    return out_wav


def program_gain_db(work: str, total: float, dialog: str | None, music: str | None) -> float:
    """Gain that brings dialog + (VO-ducked) music to the house loudness, like the master's linear loudnorm."""
    if not dialog and not music:
        return 0.0
    probe = os.path.join(work, "stems_probe.wav")
    if dialog and music:
        d = A.DUCK
        _run(["-i", dialog, "-i", music, "-filter_complex",
              f"[0:a]asplit=2[d][dsc];[1:a][dsc]sidechaincompress=threshold={d['threshold']}:ratio={d['ratio']}:"
              f"attack={d['attack']}:release={d['release']}[m];[d][m]amix=inputs=2:normalize=0,atrim=0:{total:.4f}[o]",
              "-map", "[o]", "-c:a", "pcm_s24le", probe])
    else:
        _run(["-i", dialog or music, "-c:a", "pcm_s24le", probe])
    m = A.loudness(probe)
    try:
        os.unlink(probe)
    except OSError:
        pass
    i = m.get("I")
    if i is None or not math.isfinite(i) or i < -70:
        return 0.0
    return max(-24.0, min(24.0, float(HOUSE["lufs"]) - float(i)))


def build_editor_stems(work: str, total: float, picture: str, vo: str | None, music: str | None, sfx: str | None,
                       clips: list[str], log) -> dict | None:
    """Returns {"canvas": path, "music": path|None, "gainDb": float} or None when stems could not be built."""
    try:
        dpre = dialog_pre(os.path.join(work, "stems_dialog_pre.wav"), total, vo, sfx, clips)
        mpre = music_pre(os.path.join(work, "stems_music_pre.wav"), total, music) if music else None
        g = program_gain_db(work, total, dpre, mpre)
        canvas = os.path.join(work, "editor_canvas.mp4")
        if dpre:
            _run(["-i", picture, "-i", dpre, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                  "-af", f"volume={g:.3f}dB,alimiter=limit=0.89:level=false,apad,atrim=0:{total:.4f}", "-movflags", "+faststart",
                  canvas + ".tmp.mp4"])
        else:   # no narration, SFX or footage sound: a silent track keeps the editor's audio graph simple
            _run(["-i", picture, "-f", "lavfi", "-t", f"{total:.4f}", "-i", "anullsrc=r=48000:cl=stereo", "-map", "0:v", "-map", "1:a",
                  "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", canvas + ".tmp.mp4"])
        os.replace(canvas + ".tmp.mp4", canvas)
        mus = None
        if mpre:
            mus = os.path.join(work, "editor_music.m4a")
            _run(["-i", mpre, "-af", f"volume={g:.3f}dB,alimiter=limit=0.89:level=false", "-c:a", "aac", "-b:a", "256k",
                  "-movflags", "+faststart", mus + ".tmp.m4a"])
            os.replace(mus + ".tmp.m4a", mus)
        for p in (dpre, mpre):
            if p and os.path.exists(p):
                os.unlink(p)
        log("editor_stems", f"editor stems ready: dialog canvas{' + separate music' if mus else ''} ({g:+.1f} dB)",
            {"gainDb": round(g, 2), "music": bool(mus)})
        return {"canvas": canvas, "music": mus, "gainDb": round(g, 2)}
    except Exception as exc:  # noqa: BLE001 - the master export must never fail because of editor stems
        log("editor_stems_warning", "editor stems could not be built; the editor gets the full mix as one track",
            {"error": str(exc)[:300]})
        return None
