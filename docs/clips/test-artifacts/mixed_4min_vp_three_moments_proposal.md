# VP: 3 moments vs Opus (proposal — not deployed)

## Observed (`proj_9bf8c481`, lite after 3.8 RPD cap)

- **3 VP moments:** one talk (27.5–56.5s), **two gaming** both peak **163s** (147–165 and 160–169).
- **Opus reference:** ~5 distinct talk bits + 2 Apex (win + “squad gets surrounded” ~118–145s).

## Why one talk moment

1. **`min_moments_for_video(226s) == 3`** — prompt asks Gemini to return **at least 3**, not “all good moments”; model fills quota with highest scores (talk + 2× win).
2. **No VP post-dedupe** on overlapping peaks/categories before pass1 seeds — duplicate Apex spans both kept.
3. **Fight window under-represented:** ASR gap ~140–162s; model may collapse “squad surrounded” into one endgame win blob at 163s.
4. **Pass1 still got 4 LLM moments + 3 visual seeds** — talk at 52–72s existed in transcript/pass1 but **lost in VP shortlist** before seeds.

## Proposed fix (when Rick says go)

1. **`min_moments_for_video`:** for uploads &lt;5 min use **`max(3, ceil(duration_min/2))` → 4** for 226s (or env `VIDEO_PICKER_MIN_MOMENTS`).
2. **After Gemini parse:** `dedupe_video_picker_moments()` — drop same-category spans with peak within 15s (keep higher score).
3. **Prompt:** require **distinct peaks ≥20s apart** and at least one moment in 80–150s when `gaming` section present.
4. **Optional:** cap **1 moment per category band** (talk pre-game / gaming / talk tail) for short uploads.
