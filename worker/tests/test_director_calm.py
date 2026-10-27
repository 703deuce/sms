import numpy as np

from director import (
    MIN_SHOT_CLOSE,
    apply_switch_hysteresis,
    merge_short_segments,
    run_director,
    style_config,
    viterbi_layouts,
)


def _synth_speak(n_frames: int = 150, fps: float = 5.0):
    n_per = 2
    speak = np.ones((n_per, n_frames)) * 0.3
    visible = np.ones((n_per, n_frames))
    speak[0, :60] = 0.9
    speak[1, 60:120] = 0.9
    speak[0, 120:] = 0.9
    times = np.arange(n_frames) / fps
    return times, speak, visible, fps


def test_min_shot_length_after_merge():
    times, speak, visible, fps = _synth_speak()
    speak = apply_switch_hysteresis(speak, fps)
    path = viterbi_layouts(speak, visible, fps, style_config("speaker_follow"))
    path = merge_short_segments(path, fps)
    min_frames = int(round(MIN_SHOT_CLOSE * fps))
    segs = []
    s = 0
    for j in range(1, len(path) + 1):
        if j == len(path) or path[j] != path[s]:
            segs.append(j - s)
            s = j
    for dur in segs[:-1]:
        assert dur >= min_frames or dur == len(path)


def test_hysteresis_reduces_oscillation():
    fps = 30.0
    n = 180
    speak = np.zeros((2, n))
    for t in range(n):
        speak[0, t] = 0.9 if (t // 5) % 2 == 0 else 0.4
        speak[1, t] = 0.4 if (t // 5) % 2 == 0 else 0.9
    raw_switches = np.sum(np.diff(np.argmax(speak, axis=0)) != 0)
    smooth = apply_switch_hysteresis(speak, fps)
    smooth_switches = np.sum(np.diff(np.argmax(smooth, axis=0)) != 0)
    assert smooth_switches < raw_switches


def test_run_director_no_zero_length_segments():
    times, speak, visible, fps = _synth_speak(n_frames=200)
    words = [{"w": "hi", "s": 12.0, "e": 12.4, "spk": 1}]
    segs = run_director(times, speak, visible, fps, "speaker_follow", words)
    for s in segs:
        assert s["t1"] > s["t0"] + 1e-3
