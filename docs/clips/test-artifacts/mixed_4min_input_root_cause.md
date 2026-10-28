# mixed_4min — video picker input root cause (2026-10-28)

Worker diag: `diagnose_mixed_4min_inputs.py` on `proj_3edeaf9309b74bbfa8ce5313b0e346c3`.

## Rick truth (reference)

| Event | Wall time | Seconds |
|-------|-----------|---------|
| “Move fast” | 1:21 | ~81 |
| Firefight callouts | 1:58–2:25 | 118–145 |
| “That’s how you win…” (Bloodhound) | ~2:20–2:28 | ~140–148 |
| CHAMPION banner on screen | ~2:26–2:48 | ~146–168 |
| Meow bit | 3:27–3:43 | 207–223 |

Talk clip **52.5–72.7s** was correctly placed → early-window transcript + video agree.

## 1. Transcript we send (`format_timestamped_transcript`, 70–230s)

**Not shifted globally** for early lines:

- `[81.22s] Move fast and eat ass.` — matches **1:21** truth.

**Gameplay / fight window (118–145s):** transcript is **casual chat** (YouTube, TSM, “hard red”), **not** fight callouts. Word-level ASR shows **no tokens from ~140.2s to ~161.9s** (~22s hole) where the firefight happens.

**Win line is in transcript at the right era (not at 220s):**

- `[163.21s] That's how you win a game as bloodhounds.` — ~**2:43**, consistent with banner ~**2:48** (168s), not end-of-file.

**Meow:** philosophy starts **`[172.14s]`** (~2:52) in transcript; Rick’s **performance meow** is **207–223s**. Transcript covers meow *topic* from 172s onward (sentence-anchored at line start), so peaks can look ~35s early if the model follows line starts.

**Conclusion:** Misplaced **220–226s “Apex win”** moments are **not** explained by transcript putting the win at 220s (transcript says **163s**). Likely **visual anchoring + sparse ASR in 118–162s** + **transcript-before-video** (see §3). Meow drift is partly **ASR line timing** (172 vs 207).

## 2. Proxy / clock

| | `source.mp4` | `video_picker_upload.mp4` |
|--|--------------|---------------------------|
| `format.duration` | 226.000s | 226.000s |
| `video.start_time` | 0 | 0 |
| `audio.start_time` | 0 | 0 |

No trim offset; **no double-offset from proxy length**.

- Frame extract at **`-ss 150`** on proxy: OK (19KB JPEG).
- Labeled-frame mode tags frame index 75 as **`[t=150.0s]`** at fps=0.5 — consistent with index/fps (not verified against OCR of burn-in; proxy timeline is 0–226).

## 3. Gemini video guidance vs our payload

- **Default `transcript_first`** → text **before** visual parts. Google video-understanding docs recommend placing **text after** the video part for understanding.
- **`video_metadata` `startOffset`/`endOffset`** were set to `0s`/`226s` on a **already 226s** proxy — redundant; can confuse “offset within asset” vs absolute timeline.
- **Input path (614ed67e):** `VIDEO_PICKER_LABELED_FRAMES=true` → **labeled JPEGs + audio**, not `video/mp4`. Logged as `input_mode` in meta/telemetry.

## 4. Fixes applied (614ed67e+)

1. Default **`VIDEO_PICKER_USER_PART_ORDER=video_first`** (visual timeline before transcript block).
2. Transcript lines: **`[MM:SS | N.Ns]`** for alignment with Google MM:SS guidance.
3. **Drop `startOffset`/`endOffset`** on full-span watch proxy (keep `fps` only).
4. **`video_picker_input` log line** with `input_mode`, `part_order`, `model_requested`.
5. Keep **3.8 → 3.5-flash-lite** logged fallback + `model_used` in picker telemetry.

**Not changed yet:** re-transcribe fight gap; word-level picker transcript for 100–180s (follow-up if moments still drift).
