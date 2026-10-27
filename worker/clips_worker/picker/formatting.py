from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals


def _ts(ms: int) -> str:
    s = ms / 1000.0
    m = int(s // 60)
    sec = s % 60
    return f"{m:02d}:{sec:04.1f}"


def format_sentence_line(s: Sentence, sig: SentenceSignals) -> str:
    pitch_var = max(0.0, min(1.0, (sig.pitch_z + 2) / 4.0))
    pause_b = sig.pause_before_ms / 1000.0
    pause_a = sig.pause_after_ms / 1000.0
    t0_s = s.start_ms / 1000.0
    t1_s = s.end_ms / 1000.0
    return (
        f"[s{s.idx} {_ts(s.start_ms)}-{_ts(s.end_ms)} t_abs={t0_s:.1f}-{t1_s:.1f}s spk={s.speaker} "
        f"loud_z={sig.rms_z:+.1f} pitch_var={pitch_var:.2f} "
        f"pause_before={pause_b:.1f} pause_after={pause_a:.1f} "
        f"laugh={int(sig.laugh)} xtalk={int(sig.overlap)} q={int(sig.question)} num_ent={int(sig.has_entity)}] "
        f"{s.text}"
    )
