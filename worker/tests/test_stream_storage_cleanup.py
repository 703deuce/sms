from clips_worker.streamer.bulk_keys import collect_bulky_stream_keys


def test_collect_bulky_keys_keeps_signals_only_in_chunk_meta():
    ws = "ws_1"
    vod = "svod_1"
    state = {
        "audioKey": f"ws/{ws}/streams/{vod}/audio.opus",
        "chatKey": f"ws/{ws}/streams/{vod}/chat.jsonl.gz",
        "chunks": {
            "0": {
                "wordsKey": f"ws/{ws}/streams/{vod}/chunks/0.words.json",
                "signalsKey": f"ws/{ws}/streams/{vod}/chunks/0.signals.json",
            }
        },
    }
    keys = collect_bulky_stream_keys(
        workspace_id=ws,
        vod_id=vod,
        state=state,
        clip_rows=[{"id": "clip_a", "projectId": "proj_1", "sourceSegKey": "ws/ws_1/projects/proj_1/clips/clip_a/source_seg.mp4"}],
    )
    assert f"ws/{ws}/streams/{vod}/chunks/0.opus" in keys
    assert state["chunks"]["0"]["wordsKey"] in keys
    assert state["chunks"]["0"]["signalsKey"] not in keys
    assert "source_seg.mp4" in keys[-1]
