"""T6.7: one audio-extraction recipe for every transcript / picker / signal input.

Twitch (and many re-muxed) MP4/TS files have audio gaps stored as a single long packet
(muted segments, dropped audio) and/or an audio stream that starts after the video
(``start_time`` 4.8 s, 12.3 s on real uploads). A plain ``ffmpeg -i src -vn out.wav``
writes the *samples* back-to-back, so every gap and the start delay are squeezed out and
the transcript timeline drifts away from the video timeline (one 5.8 s gap put every later
caption 5.8 s early; one upload's 235 s video produced 101 s of audio).

``PTS_ALIGN_AF`` re-times the audio to its presentation timestamps: ``first_pts=0`` pads
the start so audio t=0 is video t=0, ``async=1`` inserts silence for gaps (and trims
overlaps) so audio time == media time everywhere. Clips, previews and exports are cut by
timestamp (``ffmpeg -ss``), so words timed on this audio line up with them.
"""
from __future__ import annotations

from pathlib import Path

PTS_ALIGN_AF = "aresample=async=1:min_hard_comp=0.100000:first_pts=0"


def audio_extract_cmd(
    src: Path | str,
    dest: Path | str,
    *,
    rate: int | None = 16000,
    mono: bool = True,
    codec: str | None = None,
    bitrate: str | None = None,
    ss_s: float | None = None,
    t_s: float | None = None,
    fmt: str | None = None,
    quiet: bool = True,
    overwrite: bool = True,
) -> list[str]:
    """ffmpeg argv that extracts ``src``'s audio aligned to the video timeline.

    ``dest`` may be ``"-"`` (stdout, pass ``fmt`` e.g. ``"s16le"``)."""
    args = ["ffmpeg"]
    if overwrite:
        args.append("-y")
    if quiet:
        args += ["-v", "error"]
    if ss_s is not None and ss_s > 0:
        args += ["-ss", f"{float(ss_s):.3f}"]
    args += ["-i", str(src), "-vn", "-af", PTS_ALIGN_AF]
    if t_s is not None and t_s > 0:
        args += ["-t", f"{float(t_s):.3f}"]
    if mono:
        args += ["-ac", "1"]
    if rate:
        args += ["-ar", str(int(rate))]
    if codec:
        args += ["-c:a", codec]
    if bitrate:
        args += ["-b:a", bitrate]
    if fmt:
        args += ["-f", fmt]
    args.append(str(dest))
    return args
