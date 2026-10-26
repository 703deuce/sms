"""Resume / transcript helpers for PROCESS_PROJECT recovery."""
import json

from clips_worker.process_helpers import job_payload, stored_transcript_words


def test_job_payload_parses_json_string():
    job = {"payload": json.dumps({"resume": True, "recovery": "watchdog"})}
    assert job_payload(job)["resume"] is True


def test_stored_transcript_words_from_list():
    project = {"transcriptWords": [{"w": "hi", "s": 0, "e": 100}]}
    words = stored_transcript_words(project)
    assert words and words[0]["w"] == "hi"


def test_stored_transcript_words_empty():
    assert stored_transcript_words({}) is None
    assert stored_transcript_words({"transcriptWords": []}) is None
