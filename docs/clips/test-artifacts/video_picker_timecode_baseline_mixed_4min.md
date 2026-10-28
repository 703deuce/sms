# VP timecode baseline — `mixed_4min` (226s)

Worker **`c15ff067e`**. Variant `38_a_baseline` (`gemini-3.8-flash`, LOW, fps 0.5, default `transcript_first`).

## Ground truth (Rick)

| Segment | Start (s) | End (s) |
|---------|-----------|---------|
| Talk | 0 | 80.4 |
| Apex gameplay | 80.4 | 170.4 |
| Talk (meow bit) | 170.4 | 226 |
| Apex win / fight | ~120 | ~152 |
| Meow riff | ~207 | 226 |

## Run notes

- **3.8-flash:** repeated **503** (high demand) after backoff → **`gemini-3.5-flash-lite`** fallback (logged `model_fallback`).
- **Time validation:** first responses had `moment[1].end_s≈249` → **time_invalid** + **one retry** with clock reminder; final JSON still flagged then **clamped** (no >226 in output).
- **Burned-in clock** + `video_metadata` `startOffset`/`endOffset` + section clamp active.

## Model output (flash-lite after 503)

### Sections (clamped)

| start_s | end_s | activity |
|--------:|------:|----------|
| 0 | 120 | talking+gaming |
| 120 | 165 | gaming |
| 165 | 226 | talking |

vs truth: gaming should span **~80–170**, not 120–165 only; talk tail **170–226** is roughly aligned.

### Moments

| start–end | peak | vs truth |
|-----------|------|----------|
| 54–85 | 81 | Early talk; overlaps truth pre-Apex talk ✓ |
| 170–226 | 174 | Meow — **starts ~37s early** (truth ~207–226) |
| 220–226 | 226 | Apex win — **~100s late** (truth ~120–152) |

Coverage flags: apex ✓ meow ✓ (heuristic), but **timestamps still wrong** on fight/meow despite better sections.

## Next

- Re-run `BENCH_ONLY=38_a_baseline` when 3.8 is not 503 to measure Flash-with-timecode without lite fallback.
- If drift persists on 3.8, tighten drawtext to explicit `t`-based HH:MM:SS and cross-check peaks against transcript `[NN.Ns]` lines.
