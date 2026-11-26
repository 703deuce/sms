# Call triage (offline, no calls placed) — partial, stopped early on request
Skipped: 19 twopeople calls (Dana/Mike Cole). Non-twopeople calls: 110.
Covered for all 110: silence/stall scan (/tmp/sil5.py: gap from end of caller turn to start of a substantive reply).
Read in full by hand: 16 calls. The other ~94 were NOT graded by hand (only auto flags in /tmp/triage.out).

## Stall scan (all 110)
Only 9 waits of 8 s or more in 110 calls:
- 004440 38 s, 012125 30 s: the caller had to speak again.
- 041100 20 s, 040846 15 s: the caller had said they would wait.
- The rest were 8–10 s.
Nothing over 10 s after img28, apart from the two waits where the caller asked to hold.
(An earlier 16 s "stall" I reported for 072013 was a measuring mistake: transcript times mark the end of each line, not the start. 072013 is fine.)

## REAL
| call | scenario | image | what happened | status | cause |
|---|---|---|---|---|---|
| 20261125234133 | urgent transfer | img4 | Said "I'll connect you to Rick" but no transfer was started | Fixed img5 (transfer tool used from 234330 on) | a (also c, e) |
| 20261126002446 | intent | img10 | Call ended 46 s in, right after the caller's first sentence; no details taken; our own line stored as the number | Likely fixed by img25 end-call/goodbye guards; not seen since | e (also c) |
| 20261126004440 | booktime | img14 | ~35 s silence after the request; the caller had to repeat it all; booked 2:30 correctly after that | Not seen again after img14 (no specific fix) | c |
| 20261126012125 | unavail | img15 | ~30 s silence, the caller spoke again; call ended incomplete (stall scan only, transcript not read) | Not seen again after img15 | c |
| 20261126041100 | infodump | img28 | 3 calendar bookings for one caller (from the auto flag) | Fixed img30 (duplicate-booking guard) | e |
| 20261126044929 | interrupt | img29 | Kim booked twice (from the auto flag) | Fixed img30 | e |

Causes: a=delegation failure, b=gpt-live-1.1 only, c=gpt-live-1, d=unrealistic test setup, e=our code bug since fixed.
Primary-cause counts: a 1, b 0, c 2, d 0, e 3. All 6 REAL calls ran on gpt-live-1. b and d are 0 because twopeople was skipped and the 1.1 calls weren't graded.

## BORDERLINE
- 000522 (booktime, img6): broken, cut-off lines ("I've passed your request and You're very welcome"). Message captured. Live booking wasn't built yet.
- 002844 (booktime, img11): only morning slots offered, "nothing after 1 PM". Can't check against that day's calendar. Message taken.
- 073720 (kbq, img34): the price line was cut off when the caller talked over it. The refund answer came after the caller's "let me hold", ~25 s after the question. All facts were right.
- 015621 / 032519 ("that time was just taken" before rebooking; both ended with a correct booking): fixed img26+.

## NOT A PROBLEM (read by hand)
- 234330, 234443, 001053: transfer tried, Rick didn't answer, message taken.
- 000839: transferred.
- 000131, 002230, 001743: message captured. Old no-booking setup; pushy's refusals were scripted.
- 072013: was a measuring mistake.
- 024127: the caller misspoke the digits.

## Not graded (stopped early)
Unread, worth checking first:
- 023947: number stored as 5555011
- 011233: interrupt, no booking
- 012722: urgentmsg, no transfer
- 012912: linkbook, incomplete
- 015908 / 020455: unknown caller, no booking / incomplete
- The 1.1 incomplete calls: 030240, 030452, 030803, 031329, 031715, 033813, 034020
- 042814: interrupt, no booking
- 071825: interrupt, our own line stored

## Correction (John, Nov 26 ~3:00 AM ET)
Backchannels, acks and lines the caller talked over are NOT problems. No REAL item above relied on them, and the borderline "cut-off lines" items (000522, 073720) move to NOT A PROBLEM where the caller was talking over the agent.

## Outcome-only errors (script /tmp/outcome.py, 110 non-twopeople calls)
Counted only: no/wrong booking, no availability check (when tool logs exist and no booking resulted), unsaved message, no transfer/emergency attempt, both-sides silence ≥8s. Backchannels and talked-over lines excluded.

Live-era: 7 calls.
- 234133 transfer img4: no transfer attempt. Fixed img5.
- 011233 interrupt img15: no booking.
- 012722 urgentmsg img15: no transfer attempt. Not retested later.
- 034020 interrupt img25 (gpt-live-1.1): checked availability, no booking.
- 041100 infodump img28: 3 bookings for one caller. Fixed img30.
- 042814 interrupt img29: checked availability, no booking.
- 044929 interrupt img29: 2 bookings for Kim. Fixed img30.

No cases of unsaved message, missed check (with logs present and no booking), or both-sides silence ≥8s.

Pre-live (booking not on yet, 3): 232829, 000522, 002844. Fixed once live booking was on.

Interrupt no-booking also appeared on img25 (1.1) and img29; later img33–34 interrupt calls booked. Not tied to one fix.

First-speech latency (caller-side audio onset, mm-hm counts): 100 logs, 435 turns, p50 1.98s, p95 3.04s.
