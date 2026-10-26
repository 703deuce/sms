import json
from pathlib import Path

from clips_worker.caption_words import build_caption_words

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "caption_parity.json"


def test_caption_parity_fixture():
    data = json.loads(FIXTURE.read_text())
    out = build_caption_words(data["words"], data["edits"])
    assert out == data["expected"]
