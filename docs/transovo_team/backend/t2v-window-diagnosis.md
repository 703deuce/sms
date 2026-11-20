# T2V: why the edit played a different slice than the one judged (NEW 2)

Line numbers are on `origin/master` c69f93a98 (#1194 merged). Real data, prod DB (read-only), Sat Nov 14, 2026.

## The real cases

| case | verify job (stored) | shot need | what played | ground truth (describe test) |
|---|---|---|---|---|
| cafe 2339, sleep L10 ("…set bright screens aside before bed", a cut inside sc_9) | `inS 0.0, outS 35.0, clipS 35` (the whole clip), score 9 | 3.3 s | `srcInMs 0`, i.e. 0-3.3 s | phone held up ~3-7 s, put down by ~9 s, then 25 s of eating |
| flashlight 144635, snow sh3 | 14:56 job `inS 4.0, outS 10.0` (8); 17:02 job `inS 0.0, outS 5.0` (9) | 2.0 s | from 0, ~2.4 s | near-black for the first ~2 s, the flashlight is obvious mid-clip |

## Cause, step by step

1. **The window was a guess in the same call that judged the line, often "the whole clip".**
   `verify_stock.py:122` asks for in_s/out_s in the same answer as the score, from 1 fps frames, with the line already
   in mind. For 2339 the model returned 0-35 s. `_clamp_window` (`verify_stock.py:488-507`) only grows a window that is too
   SHORT (and resets one under 0.5 s to the whole clip, `:496`); a too-LONG window is kept, so `inS = 0`
   (`verify_stock.py:585, :602`).
2. **The finisher played the window from its START.** `t2v-finisher.ts:269`
   `srcInMs = min(pick.inS, durationS - needS - 0.3)`: a 3.3 s shot plays the first 3.3 s of the judged window. With
   2339's window 0-35 s that is 0-3.3 s (phone held up, "raises a phone"); with 144635's 0-5 s window it is the
   near-black first 2.4 s. The same min() also MOVED a late window (one ending near the clip end) earlier, onto
   frames nobody judged.
3. **Everything downstream copied that start unchanged** (no other overwrite): `toPick` `t2v-no-repeat.ts:171` and
   `evToPick` `t2v-finisher.ts:72` copy inS/outS; `job.py:161, :259` read `srcInMs`; `assemble.py` seeks `-ss src_in`.
   One more slice change in assembly: `assemble.py:133` loops the source (`-stream_loop -1`) when the line runs past
   the clip end, so the shot jumps back to second 0 mid-line.
4. **The cheap checks measured the wrong slice too.** Motion, colour/luma and dHash ran over the whole judged window
   (`verify_stock.py:614, :621`), not the slice that plays, so a dark or frozen first 2 s did not register.
5. **Borrowed clips** (placed under another line) kept the ORIGINAL line's window.

Not the cause: in_s/out_s were not ignored, not clamped to 0 by assembly, and the 1 fps sampling is fine (the
describe test's second-by-second answers place both events correctly at LOW).

## Fix (this PR)

- Pass 1 writes a blind, TIMESTAMPED observation (events `{t_start, t_end, visible, action, motion, lighting}`).
- Pass 2 (text only) picks in_s/out_s FROM those event times, snapped to event boundaries, and judges only the events
  inside it.
- The worker turns that into the slice that plays (`play_window`: need × 1.1 + 0.3 s, centred in the window, inside the
  clip, never snapped to 0). If that slice reaches ≥ 0.5 s into events pass 2 did not judge, pass 2 re-judges exactly
  that slice (text only). `inS/outS` = the verified slice; `judgedInS/judgedOutS` = pass 2's own window. Motion,
  luma, frozen and hash checks run on the verified slice.
- The finisher plays `srcInMs = inS` unchanged (`t2vPlaybackWindow`, clamped only to the clip) and writes
  `windowInMs/windowOutMs` on the media; borrowed clips get the window the re-check picked from the observed events.
- Assembly never loops a clip long enough for the line (moves the start back just enough instead) and logs
  `[t2v:assemble:window] {media, verified, rendered, outsideS, startMatches, looped}` for every video shot.
