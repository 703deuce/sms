from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals


def _ts(ms: int) -> str:
    s = ms / 1000.0
    m = int(s // 60)
    sec = s % 60
    return f"{m:02d}:{sec:04.1f}"


def format_sentence_line(s: Sentence, sig: SentenceSignals) -> str:
    tags = [f"loud{sig.rms_z:+.1f}", f"pitch{sig.pitch_z:+.1f}", f"pause_before {sig.pause_before_ms}ms"]
    if sig.laugh:
        tags.append("laugh?")
    if sig.overlap:
        tags.append("overlap")
    if sig.question:
        tags.append("question")
    if sig.has_entity:
        tags.append("entity")
    tag_str = ", ".join(tags)
    return f"[#{s.idx} {_ts(s.start_ms)} {s.speaker}] {s.text} {{{tag_str}}}"
