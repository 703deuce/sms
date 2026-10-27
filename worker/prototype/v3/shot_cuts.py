"""Shot boundary detection for multiperson tracking resets."""
from __future__ import annotations

import numpy as np

try:
    from tracking import histogram_shot_cuts
except ImportError:
    from prototype.v3.tracking import histogram_shot_cuts  # type: ignore[no-redef]


def _cuts_from_scenedetect(video_path: str) -> list[float]:
    from scenedetect import ContentDetector, detect

    scenes = detect(video_path, ContentDetector(threshold=27, min_scene_len=15))
    times = [0.0]
    for scene in scenes:
        start_tc = scene[0]
        start = float(start_tc.get_seconds()) if hasattr(start_tc, "get_seconds") else float(start_tc)
        if start > 0:
            times.append(start)
    return sorted(set(times))


def scene_cut_times(
    video_path: str,
    gray_frames: list[np.ndarray] | None = None,
    *,
    times_s: list[float] | None = None,
) -> list[float]:
    """Return shot-start times in seconds (always includes 0.0)."""
    try:
        return _cuts_from_scenedetect(video_path)
    except Exception:
        if gray_frames is not None:
            idx = histogram_shot_cuts(gray_frames)
            if times_s and len(times_s) == len(gray_frames):
                return sorted({times_s[i] for i in idx})
            return [0.0] + [float(i) for i in idx if i > 0]
        return [0.0]


def sample_indices_at_cuts(
    cut_times_s: list[float],
    sample_times_s: list[float],
) -> list[int]:
    """Map scene cut times to indices in the sampled timeline."""
    if not sample_times_s:
        return [0]
    cuts = {0}
    for ct in cut_times_s:
        if ct <= 0:
            continue
        j = int(np.argmin(np.abs(np.array(sample_times_s) - ct)))
        cuts.add(j)
    return sorted(cuts)
