"""Loop and stall guard (borrowed from Hermes agent/tool_guardrails.py, MIT). Pure functions; agentd.watch_loop feeds
it the newest tool calls and their results.

- identical: the same tool, the same arguments AND the same result in a row. Same call with a different result
  (a poll that moved, a retry that got further) is normal and not counted.
- cycle: A,B,A,B (period 2) or A,B,C,A,B,C (period 3) with identical results each time.
- warn at 3 identical or 2 full cycles; halt at 6 identical or 4 full cycles. A new call that breaks the pattern resets
  it (the level is recomputed from the newest calls every check).
Off switch: runner/state/LOOP_GUARD_OFF (falls back to the old 3-identical nudge being off too)."""
import hashlib, json

WARN_SAME, HALT_SAME = 3, 6
WARN_CYCLES, HALT_CYCLES = 2, 4


def sig(tool, args, result):
    a = json.dumps([tool, args], sort_keys=True, default=str)
    rs = hashlib.sha1(str(result or '').encode('utf-8', 'replace')).hexdigest()[:12]
    return hashlib.sha1(a.encode('utf-8', 'replace')).hexdigest()[:12] + ':' + rs


def trailing_same(seq):
    n = 0
    for s in reversed(seq):
        if s != seq[-1]:
            break
        n += 1
    return n


def trailing_cycles(seq, period):
    """How many full repeats of the last `period` calls end the sequence (needs >=2 distinct calls in the unit)."""
    if len(seq) < period * 2:
        return 0
    unit = seq[-period:]
    if len(set(unit)) < 2:
        return 0
    n, i = 0, len(seq)
    while i - period >= 0 and seq[i - period:i] == unit:
        n += 1
        i -= period
    return n


def assess(seq):
    """seq: oldest -> newest call signatures. Returns (level, kind, count, key): level 'ok' | 'warn' | 'halt'."""
    if not seq:
        return 'ok', '', 0, ''
    same = trailing_same(seq)
    cyc, per = 0, 0
    for p in (2, 3):
        c = trailing_cycles(seq, p)
        if c > cyc:
            cyc, per = c, p
    key_same = seq[-1]
    key_cyc = '|'.join(sorted(set(seq[-per:]))) if per else ''
    if same >= HALT_SAME:
        return 'halt', 'identical', same, key_same
    if cyc >= HALT_CYCLES:
        return 'halt', f'cycle{per}', cyc, key_cyc
    if same >= WARN_SAME:
        return 'warn', 'identical', same, key_same
    if cyc >= WARN_CYCLES:
        return 'warn', f'cycle{per}', cyc, key_cyc
    return 'ok', '', 0, ''


def warn_text(kind, n):
    what = (f'your last {n} tool calls were identical (same tool, same arguments, same result)' if kind == 'identical'
            else f'you are going back and forth between the same {kind[-1]} tool calls ({n} rounds, same results each time)')
    return ('[Loop guard] Warning: ' + what + '. Repeating it will not change the outcome. Read the last output '
            'carefully, then change approach: a different source, query, tool, selector or parameter; or write what you '
            'know to log/notes/ and move to the next part. If you are waiting on a helper, use `helper result ID --wait '
            '300`. If it truly cannot work, say so in your reply. This is an automatic check, not a new request from Rick.')


def halt_text(kind, n):
    return ('[Loop guard] STOP: you kept repeating the same tool calls after a warning (' + kind + f', {n} times). Do not '
            'call that tool again. Write your final reply now with what you have: what is done (with file paths), what '
            'is not done, and the exact obstacle you hit. If you keep repeating, the run will be stopped. This is an '
            'automatic check, not a new request from Rick.')
