from clips_worker.ai_producer_agent.finder import run

def test_absolute_visual_windows_keep_second_window_moments(tmp_path, monkeypatch):
    monkeypatch.setenv("CLIPPER_SCRATCH",str(tmp_path))
    monkeypatch.setattr(run,"download_object",lambda key,destination:None)
    def watcher(*args,**kwargs):
        assert kwargs["range_start_ms"]==1_200_000
        return ([{
            "start_s":10.0,"end_s":40.0,"peak_s":20.0,
            "score":95,"category":"reaction","what_happened":"visible reaction",
        }], [], {"est_usd":0.01})
    monkeypatch.setattr(run,"watch_upload_range",watcher)
    source={
        "sourceId":"upload","storageKey":"ws/1/source.mp4",
        "rangeMs":[1_200_000,2_400_000],"durationMs":1_200_000,
    }
    result=run.run_analyze_payload(None,job={"id":"job_second"},payload={
        "sources":[source],"mode":"best_moments",
        "visualEvidence":{"enabled":True,"model":"gemini-3.1-flash-lite"},
    },progress=lambda *_:None)
    assert any(abs(x["start_s"]-1210)<1 for x in result["moments"])
