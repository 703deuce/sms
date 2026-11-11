# Legacy photo-ads pipeline (from 703deuce/headshot)

These files are an **unmodified** copy of the photo-ads / ad-to-video pipeline Rick tested, so Ad Studio can be ported against the exact prompts and reference handling that produced the good stills.

## Origin

- Repo: [703deuce/headshot](https://github.com/703deuce/headshot) (private)
- Default branch: `master`
- Current master (library still present; Photo Ads UI later removed): `0d28d6fa79648f851861b62a4949cff6acc1913d` (2026-06-26 19:14 EDT)
- Photo Ads UI + `/api/suite/generate/ad-to-video` last present at `1e26a5a325294f2dff5bd41e6f0f2c9cbb9b2584` (2026-05-12) and still identical at `210842673050a54ab880405daffefc774911717f`
- Deleted from headshot in `2315567da64634e5140a4297f0162f407544c8d9` (2026-05-16)
- `kimi_assets/` and `scripts/` were gitignored and were **never committed**. A Git history search for path `kimi_assets` returned no commits. Do not invent extra example images.

No secrets are included. Env var *names* only (`GEMINI_API_KEY`, `KIMI_API_KEY`, `KIE_API_KEY`, `OPENAI_API_KEY`).

## Verbatim sources in this folder

| Path here | Origin path | Notes |
|---|---|---|
| `src/marketing-suite/lib/kimi.ts` | same, at `0d28d6fa` | Kimi k2.5 concept writer, 14 buckets, style-ref loader, `reviewGeneratedPhotoAdForQc`, `checkAdVideoTextSpelling`. Default batch `options?.count ?? 5` (clamped 1–20). |
| `src/marketing-suite/lib/gemini.ts` | same, at `0d28d6fa` | Gemini-native twin of the prompt writer. `PHOTO_ADS_PROMPT_COUNT = 5` (exactly 5). Models: `gemini-3-flash-preview`, `gemini-3.1-pro-preview`. |
| `src/lib/kie.ts` | same, at `0d28d6fa` | Nano Banana Pro / Edit via Kie, Sora 2 / Kling I2V. Stills are **2K PNG**. Product photo is first `image_input`, then logo, then extras (max 8). Sizes: `square` 1:1, `story` 9:16, `portrait` 3:4, `landscape` 16:9. |
| `src/marketing-suite/lib/openai-sora.ts` | same, at `0d28d6fa` | Direct OpenAI Sora I2V (4/8/12s; requested 15s mapped to 12s). Prompt is a parameter. |
| `src/app/api/suite/generate/ad-to-video/route.ts` | same, last pre-deletion version above | **Default I2V prompt lives here.** UI did not show a prompt box. |
| `prompts/*.txt` | extracted from the sources above | Including `ad_to_video_default_prompt.txt`. |

Do **not** shorten, paraphrase, or “improve” these prompts when porting. Use them verbatim. The only model swap is Kimi → Gemini for the concept/QC LLM (use the Gemini system prompt in `gemini.ts` verbatim; it is the official twin). Nano Banana prompt-construction rules (product-injection opening, exact copy, typography, text-safe zone, one CTA, `Think step-by-step: 1) spatial physics 2) text rendering 3) lighting coherence`) must stay word-for-word.

`kimi.ts` imports film-theory types from `video-product-ads` and `kie.ts` imports `@/lib/pipeline-retry`. Those helpers are not required to copy the prompts; they were omitted here to keep this tree additive and secret-free.

## Style-reference example ads

The committed style library is the 10 PNGs listed in `DEFAULT_LOCAL_REFERENCE_BASENAMES` in `kimi.ts`. They belong in this repo at:

`new-app/lib/server/ad-studio/style-refs/`

(existing Ad Studio server code lives under `new-app/lib/server/ad-studio/`, not `new-app/src/server/`).

| File | blob SHA on headshot@0d28d6fa | size (bytes) |
|---|---|---|
| kka.png | 2317663415d81c0b6b4484b43fac8026cb0ffded | 2177649 |
| assss.png | ad0cf20acb65a733fc7f08e54e4160f9f95300cc | 2749041 |
| r1.png | ad77d4acb03fb241857799dba2265c0265981674 | 2851832 |
| r2.png | 2d3bd78d3a09468da41c6e6d3b118d7a0344862b | 2644897 |
| H1.png | a0efa11273037215a2f539aeafa0cf66db2be972 | 1034011 |
| h2.png | d00d20e1fb189e5640b3d47c03b31ed3c2e3d021 | 1041705 |
| h3.png | a96bf6b9fe30bfc0756df8db0c3c79aa86772b04 | 993316 |
| yt1.png | 5faacd4ea0857613ea582c49c4a557cc746493b2 | 2671354 |
| yt2.png | 38701a614f8e3dbc43da18184ad1394ca3e444b5 | 2737017 |
| yt3.png | 11f8d3ef3b523ea48641c8ac2c6bc69350ffcc82 | 2563948 |

If any of those PNGs are missing from `style-refs/`, copy them from `703deuce/headshot` at `0d28d6fa` (repo root; also duplicated under `src/app/` for kka/assss/r1/r2). Verify blob SHAs. Send at most 6 style refs to the vision LLM. Product photo is always first, then logo, then style refs.

Other root PNGs exist on headshot (banners, hero, Untitled, trt, vff, etc.) but are **not** in `DEFAULT_LOCAL_REFERENCE_BASENAMES`. Do not add them as style refs unless product code is updated on purpose.

## Confirmed batch size

Gemini writes **exactly 5** concepts/stills at a time (`PHOTO_ADS_PROMPT_COUNT = 5`). Kimi defaults to **5** (`options?.count ?? 5`). Port must generate 5 at a time.

## Default I2V prompt (verbatim)

See `prompts/ad_to_video_default_prompt.txt`. Core string:

`Smooth, subtle motion. Professional broadcast ad aesthetic. Cinematic, Gentle movement that brings the scene to life.`

