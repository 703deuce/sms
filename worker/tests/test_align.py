import numpy as np

from clips_worker.streamer.align import _read_pcm


def test_read_pcm_empty():
    from pathlib import Path
    import tempfile

    with tempfile.NamedTemporaryFile() as f:
        p = Path(f.name)
        p.write_bytes(b"")
        arr = _read_pcm(p)
        assert arr.shape[0] == 1


def test_correlation_finds_shift():
    ref = np.zeros(16000 * 10)
    seg = np.zeros(16000 * 3)
    ref[16000 * 5 : 16000 * 5 + len(seg)] = np.random.randn(len(seg)) * 0.1
    seg[:] = ref[16000 * 5 : 16000 * 5 + len(seg)]
    corr = np.correlate(ref, seg, mode="full")
    lag = int(np.argmax(corr) - (len(seg) - 1))
    assert abs(lag - 16000 * 5) < 16000 * 0.5
