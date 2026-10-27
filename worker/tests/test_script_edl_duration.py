import json
from pathlib import Path

from clips_worker.script_edl import (
    DEFAULT_EDL_PAD_MS,
    derive_edl,
    edl_to_trim_and_cut_ranges,
    output_duration_ms,
    sum_merged_source_span_ms,
)

FIXTURE = Path(__file__).resolve().parents[2] / "new-app" / "tests" / "fixtures" / "edl-dense-duration.json"


def _load():
    data = json.loads(FIXTURE.read_text())
    words_by_id = {
        w["id"]: {"id": w["id"], "t0Ms": w["t0Ms"], "t1Ms": w["t1Ms"], "text": w["text"]}
        for w in data["words"]
    }
    return data, words_by_id


def test_edl_output_matches_merged_source_span():
    data, words_by_id = _load()
    edl = derive_edl(data["document"], words_by_id, pad_ms=data["padMs"])
    gap_ms = sum(int(s["durMs"]) for s in edl if s["kind"] == "gap")
    out_ms = output_duration_ms(edl)
    span_ms = sum_merged_source_span_ms(edl)
    assert out_ms == span_ms + gap_ms
    assert out_ms <= data["sourceDurationMs"] + gap_ms + 100


def test_edl_trim_cuts_between_distant_clusters():
    data, words_by_id = _load()
    sparse = {
        **data["document"],
        "keptWordIds": ["m:0", "m:9"],
        "deletedWordIds": ["m:1", "m:2", "m:3", "m:4", "m:5", "m:6", "m:7", "m:8"],
    }
    edl = derive_edl(sparse, words_by_id, pad_ms=data["padMs"])
    trim_in, trim_out, cuts = edl_to_trim_and_cut_ranges(edl, data["rangeStartMs"], data["rangeEndMs"])
    assert trim_in <= trim_out
    assert len(cuts) >= 1
    cut_total = sum(c[1] - c[0] for c in cuts)
    assert cut_total > 1000


def test_pad_overlap_not_double_counted():
    data, words_by_id = _load()
    edl = derive_edl(data["document"], words_by_id, pad_ms=DEFAULT_EDL_PAD_MS)
    out_ms = output_duration_ms(edl)
    naive = len(data["words"]) * (200 + DEFAULT_EDL_PAD_MS * 2)
    assert out_ms < naive * 0.85
