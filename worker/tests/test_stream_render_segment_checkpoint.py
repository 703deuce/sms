from pathlib import Path
from unittest.mock import MagicMock, patch

from clips_worker.streamer.render_job import _checkpoint_segment_key, _fetch_segment_mp4


def test_checkpoint_segment_key_merges_state():
    conn = MagicMock()
    state = {"audioKey": "a"}
    with patch("clips_worker.streamer.render_job._save_state") as save:
        out = _checkpoint_segment_key(conn, "vod1", state, "clip1", "seg/key")
    assert out["segmentKeys"] == {"clip1": "seg/key"}
    save.assert_called_once()


def test_fetch_segment_reuses_source_seg_key(tmp_path: Path):
    seg = tmp_path / "seg.mp4"
    seg.write_bytes(b"x")
    clip = {"id": "c1", "sourceSegKey": "bucket/seg"}
    with patch("clips_worker.streamer.render_job.download_object") as dl:
        _fetch_segment_mp4(
            clip,
            {},
            seg_path=seg,
            local_upload=None,
            url="http://example",
            seg_start_s=0.0,
            seg_end_s=1.0,
            workspace_id="w",
            project_id="p",
        )
        dl.assert_called_once_with("bucket/seg", seg)
