"""No duplicate loudness/re-encode when final program is already normalized or deferred."""
from pathlib import Path

from clips_worker.export_post import apply_export_post


def test_two_pass_metadata_skips_legacy_single_pass(tmp_path):
    path = tmp_path / "finished.mp4"
    # No ffmpeg call should occur when no speed processing is necessary.
    edits = {"speechLevelingEnabled": True, "loudnessLufs": -15}
    meta = {"program_loudnorm_lufs": -15}
    result, subtitles = apply_export_post(path, tmp_path, edits, meta, srt_body=None)
    assert result == path
    assert subtitles is None
    assert meta["program_loudnorm_lufs"] == -15


def test_final_mix_deferral_skips_pre_export_loudnorm(tmp_path):
    path = tmp_path / "finished.mp4"
    edits = {"speechLevelingEnabled": True, "loudnessLufs": -15}
    meta = {"defer_program_loudness": True}
    result, _ = apply_export_post(path, tmp_path, edits, meta)
    assert result == path
    assert not meta.get("loudnorm_applied")


def test_explicit_flag_prevents_second_pass(tmp_path):
    path = tmp_path / "finished.mp4"
    edits = {"speechLevelingEnabled": True, "loudnessLufs": -14}
    meta = {"loudnorm_applied": True}
    result, _ = apply_export_post(path, tmp_path, edits, meta)
    assert result == path
