# mixed_4min test — proj_3edeaf9309b74bbfa8ce5313b0e346c3 @ worker 49f9bda5e

## UI settings (bias source)
- `mode`: talking (default)
- `genre`: podcast → `podcast_interview` playbook prompts + stricter signal-action thresholds (`loud_floor` 0.85 vs 0.65 for gaming)
- `sparse_visual` guard: signal/gap supplements skipped because Gemini returned exactly 3 visual moments (all peaks ≤92s — no Apex/meow in video picker)

## Stage timings (worker logs)
| Stage | elapsed_ms | notes |
|-------|------------|--------|
| source_download | 2,153 | |
| transcribe | 4,017 | 521 words |
| **gpu_render warmup** | **422,686** | Modal cold start — **~7.0 min** frozen ETA before picker |
| scene_scan_signals | 24,098 | |
| video_picker `regular` | 85,122 | 3 moments; 19,153 in / 795 out tokens; $0.002233 |
| video_picker `regular_edge` ×2 | 18,607 + 16,796 | edge reassess; min_moments shortfall (2<3) each |
| picker_pass1 | 5,746 | 1 LLM chunk 0–226s |
| picker_pass2 | 21,096 | 3× sequential LLM (~4.6s + 10.1s + 6.3s) |
| picker total (logged) | 147,994 | excl. GPU warmup |
| pipeline total | 704,530 | |

## Video picker (full 226s proxy, frames_est=113 @ 0.5fps)
- Ran on full upload (`range_end_ms` 226000).
- Returned **3** moments; peaks **65.75s, 65.75s, 91.97s** only (talk block) — **no gaming 80–170s, no meow 170–226s** in telemetry.
- Edge reassess fired twice; each returned 2 moments (< min_moments=3) — logged WARNING, kept output.

## Pass1 (transcript + visual hints, podcast genre prompt)
Three moments returned (includes meow on transcript):
1. s14–17 @ 58–66s — 1% friend advice
2. s6–20 @ 30–80s — tendrils / meet people (locator used as title later)
3. s54–64 @ 2:50–3:45 — meow grocery bit

## Pass2 (podcast genre rubric) — **collapse bug**
All three pass2 responses used **same** `start_id` 14 / `end_id` 17 (58–66s) despite different pass1 spans → three duplicate talk clips after boundaries.

## Selection / headstart
- Headstart heuristic (pre-pass2) finalized talk span 29–80s with **locator as title** → clip D.
- Final selection: cap=2 for ~3.8 min source; dedupe left **1** pass2 clip (52–72s extended) → clip B.
- Meow + Apex never scored as distinct spans after pass2 collapse.

## Where each moment died
| Moment | Died at |
|--------|---------|
| Talk 58–66s (1% friend) | **Survived** (pass2 pick + headstart overlap) |
| Talk 30–80s (tendrils) | **Headstart only** (locator title); dropped in final selection dedupe |
| Meow 2:50–3:45 | **Pass2** mapped to s14–17; never bounded |
| Apex ~2:00–2:32 | **Never candidate** — not in video picker; pass1 skipped gaming; signal supplement skipped (`sparse_visual`) |

## Web deploy stuck @ e60257e02
Coolify auto-deploy **failed** on b8e4cf4e8, 2405f9bc9, 49f9bda5e (not queued): `next build` Turbopack error — `mergeEditsPatch` imported from `@/lib/clips/edits` but only defined in `clip-detail.ts`.
