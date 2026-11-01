from clips_worker.gap_audio_trim import (
    gap_has_loud_program_audio,
    gap_shorten_cut_range_with_audio,
    rms_samples_from_peaks,
)


def test_loud_gap_kept():
    rms = [(t, 0.35) for t in range(400, 5000, 25)]
    assert gap_has_loud_program_audio(400, 5000, rms) is True
    assert gap_shorten_cut_range_with_audio(400, 5000, 4600, 250, rms) is None


def test_quiet_gap_cut():
    rms = [(t, 0.002) for t in range(400, 2000, 25)]
    cut = gap_shorten_cut_range_with_audio(400, 2000, 1600, 250, rms)
    assert cut is not None
    assert cut[1] - cut[0] >= 100


def test_peaks_to_rms():
    peaks = [0.5] * 400
    samples = rms_samples_from_peaks(peaks, 40.0)
    assert len(samples) > 10
    assert samples[0][1] == 0.5
