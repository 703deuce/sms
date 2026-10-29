from clips_worker.streamer.timeline import compute_cut


def test_compute_cut_window_capture_pad():
    anchor = 4670000
    pad_start_s = 30.0
    seg_anchor = anchor + int(pad_start_s * 1000)
    abs_start = anchor + 60000
    abs_end = abs_start + 30000
    rel_start, _ = compute_cut(abs_start, abs_end, seg_anchor)
    assert rel_start == 30000
