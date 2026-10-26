import time

from clips_worker.heartbeat import Heartbeat


def test_heartbeat_posts_and_stops():
    posts: list[dict] = []

    def post(_job_id: str, payload: dict) -> None:
        posts.append(payload)

    with Heartbeat("job_test", post, every_s=0.05) as hb:
        hb.update(stage="transcribing", progress=12)
        time.sleep(0.2)

    assert len(posts) >= 3
    assert posts[-1]["stage"] == "transcribing"
    assert posts[-1]["jobStatus"] == "RUNNING"
