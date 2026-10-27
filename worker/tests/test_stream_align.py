"""Segment audio alignment drift logging."""
from pathlib import Path

import numpy as np

from clips_worker.streamer.align import align_segment_ms


def test_align_logs_drift_over_200ms(monkeypatch, capsys):
    def fake_extract(_audio: Path, start_s: float, end_s: float, dest: Path) -> None:
        sr = 16000
        n_ref = int((end_s - start_s) * sr)
        n_seg = int(5.0 * sr)
        ref = np.zeros(n_ref, dtype=np.int16)
        seg = np.zeros(n_seg, dtype=np.int16)
        # Impulse in ref at 1s; in seg at 0s → ~1000ms drift when nominal matches ref window start
        if n_ref > sr:
            ref[sr] = 30000
        seg[0] = 30000
        dest.write_bytes(ref.tobytes() if "ref" in dest.name else seg.tobytes())

    monkeypatch.setattr("clips_worker.streamer.align._extract_pcm", fake_extract)

    true_ms, peak = align_segment_ms(
        Path("/tmp/fake_seg.mp4"),
        Path("/tmp/fake_audio.opus"),
        nominal_start_s=100.0,
        nominal_end_s=130.0,
        log_context={"vodId": "vod_x", "clipId": "clip_y"},
    )
    err = capsys.readouterr().err
    assert peak >= 0.6
    assert abs(true_ms - 100_000) > 200
    assert "segment_align_drift" in err
    assert "vodId=vod_x" in err
