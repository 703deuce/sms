# mixed_4min benchmark — proj_3edeaf9309b74bbfa8ce5313b0e346c3

**Fixture:** `mixed_4min.mp4` — talk ~0:00–1:20, Apex ~1:20–2:50, talk/meow ~2:50–3:46 (~226s).

| Run | Worker / web | Clips | Coverage |
|-----|----------------|-------|----------|
| **Opus Clip** (reference) | defaults: auto model/genre/length | **7** in ~8 min | friends talk + Apex win + firefight + meow |
| **Transovo** (failed run) | `49f9bda5e` + UI talking/podcast | **2** (both talk) | missed gameplay + meow as distinct outputs |
| **Fix target** | `788a08a77+` auto mode/genre, unified picker fixes | **≥7 moments considered; ≥3 shipped** (min_moments) | **match Opus coverage** with tighter boundaries |

---

## Opus Clip reference (same file, ~8 min total)

| # | Topic | Approx span | Len | Score |
|---|--------|-------------|-----|-------|
| 1 | Meow / grocery social bit | ~2:50–3:45 | 55s | 84 |
| 2 | Friends talk | (short) | 16s | — |
| 3 | Friends talk | ~1:20 area | 1:20 | — |
| 4 | Friends talk | (short) | 15s | — |
| 5 | Friends talk | (short) | 18s | — |
| 6 | Apex Bloodhound win | ~2:00–2:35 | 35s | — |
| 7 | Squad surrounded firefight | (Apex segment) | 40s | — |

**Benchmark intent:** auto settings found **three activity bands** — opening friends talk (several tight clips), **two gameplay moments** in Apex, and **one long meow payoff**. Boundaries are short on talk, full fight arcs on gameplay.

---

## Transovo output @ `49f9bda5e` (what we shipped on that run)

| # | Span (approx) | Grade / title issue | Source |
|---|----------------|---------------------|--------|
| 1 | ~0:52–1:12 | B — “Talk to 100 people…” | pass2 + selection |
| 2 | ~0:29–1:20 | D — **title = raw locator** `00:30.0–01:20.6; talking…` | headstart heuristic (pre-pass2) |

**Gap vs Opus:** 0 gameplay clips, 0 meow clip, 2 overlapping talk spans only; **below `min_moments=3`**.

---

## UI settings on failed run (bias source)
- `mode`: talking (default)
- `genre`: podcast → `podcast_interview` playbook prompts + stricter signal-action thresholds (`loud_floor` 0.85 vs 0.65 for gaming)
- `sparse_visual` guard: signal/gap supplements skipped because Gemini returned exactly 3 visual moments (all peaks ≤92s — no Apex/meow in video picker)

*(New projects: B `3f5cc5e81` sends `mode`/`genre` `auto`; worker `788a08a77` ignores legacy + uses unified v3 for selection.)*

---

## Stage timings (worker logs, `49f9bda5e`)
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

**Note:** Opus ~8 min wall clock ≈ our **picker + encode** if Modal warmup is warm; our failed run looked ~12 min wall largely due to **7 min GPU warmup** before ranking.

---

## Video picker (full 226s proxy, frames_est=113 @ 0.5fps)
- Ran on full upload (`range_end_ms` 226000).
- Returned **3** moments; peaks **65.75s, 65.75s, 91.97s** only (talk block) — **no gaming 80–170s, no meow 170–226s** in telemetry.
- Edge reassess fired twice; each returned 2 moments (< min_moments=3) — logged WARNING, kept output.
- **Vs Opus:** Gemini watch did not segment Apex/meow; Opus clearly did (clips #6–7 + #1).

---

## Pass1 (transcript + visual hints, podcast genre prompt)
Three moments returned (meow **was** found on transcript, Apex was not):
1. s14–17 @ 58–66s — 1% friend advice → maps to Opus #2–5 cluster
2. s6–20 @ 30–80s — tendrils / meet people
3. s54–64 @ 2:50–3:45 — meow grocery bit → maps to Opus **#1** (never shipped)

---

## Pass2 (podcast genre rubric) — **collapse bug**
All three pass2 responses used **same** `start_id` 14 / `end_id` 17 (58–66s) despite different pass1 spans → three duplicate talk clips after boundaries. **Killed Opus-equivalent meow (#1) and any distinct friends spans.**

---

## Selection / headstart
- Headstart heuristic (pre-pass2) finalized talk span 29–80s with **locator as title** → clip D.
- Final selection: cap=2 for ~3.8 min source; dedupe left **1** pass2 clip → clip B.
- Meow + Apex never scored as distinct spans after pass2 collapse.

---

## Where each benchmark moment died (Transovo `49f9bda5e`)

| Opus / intent | Transovo path | Outcome |
|---------------|---------------|---------|
| Meow #1 (2:50–3:45) | pass1 ✓ → pass2 **collapsed** to 58–66s | **Lost** |
| Friends talk #2–5 | pass1 partial; pass2 collapse + cap=2 + dedupe | **1–2 talk only** |
| Apex win #6 (~35s) | **Not in video picker**; signal supplement **skipped** | **Never candidate** |
| Firefight #7 (~40s) | same as #6 | **Never candidate** |

---

## Fix target (coverage + boundaries)

**Coverage (match Opus, not necessarily 7 cards):**
- At least **one meow** clip (~2:50–3:45, ~55s class).
- At least **two gameplay** clips in Apex (win + firefight / ~35–40s each).
- **Several non-overlapping friends-talk** clips in 0:00–1:20 (16–80s range), not one merged 51s blob.

**Boundaries:** honor Gemini/setup→payoff spans; pass2 must not remap every moment to one sentence block; no locator titles; selection cap ≥ `min_moments` (3 for this file) and diversity across time + activity.

**Shipped mitigations (`ebb0e5076` → `788a08a77`):**
- Unified LLM genre; auto/legacy mode/genre ignored for selection.
- Pass2 span mismatch guard; visual/signal supplements when coverage sparse; selection cap tied to `min_moments`.
- Full video-picker moments in `pickerCache`; locator titles rejected.
- Re-run `mixed_4min` on **`788a08a77`** to score against Opus table above.

---

## Web deploy (historical)
Coolify auto-deploy **failed** on b8e4cf4e8 … 49f9bda5e: Turbopack `mergeEditsPatch` missing from `@/lib/clips/edits`. Resolved **`788a08a77`** on transovo.ai health.
