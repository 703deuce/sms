# Change spec: ElevenLabs generated music in the Motion Studio producer pipeline

For a developer (or ChatGPT) implementing this in the repo. Do not push, merge, or deploy until Rick approves. Suggested local branch name: `rules/elevenlabs-music-20261119`.

This is a **skill and helper-script change only**, in the producer kit. No Transovo server, Coolify, or Modal changes. Make no paid ElevenLabs Music calls while implementing unless Rick asks; a 10-second access test has already been done (see §2).

## Goal

Give the producer a reusable music tool. For each film, the producer writes a **cue list** (one cue per mood section). The tool generates real ElevenLabs music for those cues, joins them into one `audio/music.wav`, and the existing mixer ducks that bed under the voice.

This replaces today's practice: there is **no shared music system**. For each film the producer writes a one-off numpy script (for example `<J>/audio/build_audio.py`) that synthesizes music note by note, scored to the film's timeline. Timing can be excellent — in the GTA film the drums drop at 32.7s for the turn and the final chord lands at 54.4s — but it sounds like a cheap synth, and its own ducking is only about 8 dB (`duck=1-0.6*env` in that script).

Rick (Nov 19, 2026): use ElevenLabs to generate real music, any style, with or without drums, prompted per film like the voiceover. Generate a limited amount and loop the long parts. Longer films can change music across sections. Duck under the voiceover.

## Repo and files to change

Work in the producer kit, not a random copy of the installed skill:

`producer_handoff_kit/skills/motion-studio-production/`

Required changes:

1. `RULES_FROM_RICK.md` — new dated rule in section 5 (Voice and audio).
2. `SKILL.md` — music rule next to Voice; update Path C Sound; include music in paid-call language, with a **~$2 music cap**.
3. `film-pipeline.md` — replace section 6 item 2 with the cue-list ElevenLabs procedure (prompt, generate length, looping only on long cues, join, cache, fallback, mix flags).
4. **New** `scripts/gen_music.py` — reusable tool. Input is a cue list. Output is one full-length `audio/music.wav`.

Recommended consistency edits (short, so the docs do not contradict the new default):

5. `engines.md` — the "API keys" / free-path line currently says "synthesised SFX and music" is a free path. Keep synthesised SFX free. Say synthesised/procedural **music** is the fallback when ElevenLabs fails or the music estimate would exceed about $2.
6. `craft/sound.md` section 5 (Music) — note that the score is generated with ElevenLabs from a cue list; ducking under speech is 10–18 dB via `mix_soundtrack.py` (today's one-off beds were only ~8 dB); the last cue's ending should land on the last frame, not a fade mid-phrase. Keep the existing "music is a choice", phrase-boundary, and "no sung vocal under narration" guidance.

**Do not edit `mix_soundtrack.py` source, stem names, or the editable-package audio contract.** The tool must still deliver a single 48 kHz stereo `audio/music.wav` the length of the film. Change only the **flags** used when invoking the mixer (see Ducking below).

Key (already on the producer box): `ELEVENLABS_API_KEY` in `/workspace/secrets/motion_production.env` (mode 600). Never print or log it. Test whether it is set with `[ -n "$ELEVENLABS_API_KEY" ]`.

---

## 1. ElevenLabs Music API facts

Sources opened Nov 19, 2026. Prefer these over older blog posts.

### Endpoint and auth

- Compose: `POST https://api.elevenlabs.io/v1/music`
- Official reference: https://elevenlabs.io/docs/api-reference/music/compose
- Overview: https://elevenlabs.io/docs/overview/capabilities/music
- Quickstart (API is paid-only): https://elevenlabs.io/docs/eleven-api/guides/cookbooks/music
- Composition plans (optional, not required for this first version): https://elevenlabs.io/docs/eleven-api/guides/how-to/music/composition-plans and https://elevenlabs.io/docs/api-reference/music/create-composition-plan (`POST /v1/music/plan`, no credit cost, rate-limited)

Auth header:

```
xi-api-key: $ELEVENLABS_API_KEY
Content-Type: application/json
```

Query parameter `output_format` (optional, default `auto`): codec_sample_rate_bitrate. `auto` picks `mp3_44100_128` for `music_v1` and `mp3_48000_192` for v2 models. High-bitrate options include `mp3_48000_192`, `mp3_48000_240`, `mp3_48000_320`. WAV is also documented on the overview page.

**Do not hardcode 128 kbps.** Use 192 kbps if the plan allows it, otherwise 128 kbps. Detect or configure this (see the helper spec).

### Request body (prompt mode — use this)

Provide **either** `prompt` **or** `composition_plan`, never both.

| Field | Type | Notes |
|---|---|---|
| `prompt` | string, ≤4100 chars | Natural-language description of the cue. |
| `music_length_ms` | int, 3000–600000 | Prompt mode only. If omitted, the model chooses a length. |
| `model_id` | enum | `music_v1` (default, **deprecated**, removal Jan 31, 2027), `music_v2`, `music_v2_5`. **Always pass `music_v2_5`.** |
| `force_instrumental` | bool, default false | Prompt mode only. If true, the song is guaranteed instrumental. **Default true whenever the film has narration.** |
| `seed` | int | Optional; docs say it cannot be used with `prompt`. Do not send it in prompt mode. |
| `store_for_inpainting` | bool | Default false. Leave false. |
| `sign_with_c2pa` | bool | Default false. MP3 only. Leave false unless Rick asks. |

Response: raw audio bytes in the requested format. Header `song-id` is the generated song id. HTTP 422 on validation errors. Prompts that mention artists, song titles, or copyrighted lyrics return a `bad_prompt` error (often with a suggested rewrite). Do not put artist or song names in prompts.

Length limits, two official numbers:

- Compose API: `music_length_ms` 3,000–600,000 (3 s–10 min).
- Product overview ("What's the maximum duration") and API pricing page: **3 seconds to 5 minutes**.

**Cap any single generation at 5 minutes (300,000 ms).** Planned cue generations are at the cue's own length, or 2–3 minutes when looping a long cue, so this cap should not be hit.

### Pricing

- API (dollar billing): **$0.15 per generated minute**. https://elevenlabs.io/pricing/api — "Eleven Music $0.15 per minute", "5 minute duration limit", "Commercial use licensing on Starter+ plans".
- Credit-based subscription plans: about **900 credits per minute**. https://elevenlabs.io/pricing and https://elevenlabs.io/docs/help-center/product/core-capabilities/music/how-much-does-eleven-music-cost
- Composition-plan creation does not cost credits.
- Billed per generation (and variants, if any). We generate one variant per cue call.
- Current Transovo ElevenLabs workspace (checked Nov 19, 2026, America/New_York): subscription `tier=payg`, `status=active`. Dollar API pricing applies. Character counters on that payload are for TTS, not music minutes.

**Music cost cap: about $2 per job.** Compute the estimate *before* any compose call:

```
estimate_usd = sum(generated_ms_for_cue / 60000 * 0.15)  over all cues
```

Where `generated_ms_for_cue` is:

- cue length (`(end - start) * 1000`) when the cue is **about 2 minutes or shorter** (no loop);
- **120,000–180,000 ms** (2–3 minutes, implementer/producer picks) when the cue is **longer than about 2 minutes** and will be looped.

If `estimate_usd` would exceed about $2, **do not call the API**. Log the estimate and fall back to the current procedural synth so the job never stalls. Music spend otherwise runs automatically, like TTS. Music also counts toward the existing overall paid-call budget (about $5 per job, including TTS and LLM). If the remaining overall budget is smaller than the music estimate, fall back as well.

### Cost examples (music only, first try, no retries)

Looping does not cost more than the minutes actually generated.

| Job | What to generate | Music cost |
|---|---|---|
| 60-second film, 2 cues (e.g. a turn at 32.7s) | Each cue at its own length; no loop. Total generated ≈ 60s. | **$0.15** |
| 5-minute film, 3–4 cues | Each cue at its own length if ≤ ~2 min; any longer cue is a 2–3 min generate, then looped. Usually ~5 min generated. | **about $0.75** (typical range **$0.60–$0.90** if a long cue is generated at 2 or 3 min) |
| 20-minute film, 4 cues of 2–3 minutes, looped to the sections | 4 × 2 min = 8 min, or 4 × 3 min = 12 min. Do not generate 20 min ($3.00 would exceed the cap). | **$1.20–$1.80** (under the $2 cap) |

Retries: count any compose call that returned audio toward the $2 running total. A second attempt is allowed only if `running_total + that_cue_estimate ≤ 2`. If the retry would break the cap, or the second attempt fails, fall back. A format-only rejection with no audio may be retried at 128 kbps without counting against the cap.

### Commercial-use terms (open item for Rick before this goes live)

- Music Terms (updated 9 Oct 2026): https://elevenlabs.io/music-terms
- Publish / commercial license FAQ: https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform
- Product claim: cleared for nearly all commercial uses, with plan-specific limits: https://elevenlabs.io/docs/overview/capabilities/music

Material points from Exhibit A of the Music Terms:

- **API access:** no on Free; yes from Starter upward. Our payg key already works (test call succeeded).
- **Media rights (Starter through Business, and Enterprise Music Lite):** all online and offline commercial use permitted, **except film, TV, radio, and Studio Games**. Full media rights (including those) are **Enterprise Music** only.
- **Music streaming distribution** (Spotify-style DSPs): prohibited on Free and Starter; permitted from Creator up.
- **Music library creation and distribution:** prohibited on all self-serve plans. Generating a unique bed per video and mixing it into that video is fine. Do not build a reusable stock-music library for customers or for other jobs.
- **Model resale:** prohibited. Shipping a finished video that contains Output through Transovo is allowed; do not expose the Music API or models to customers.
- **Attribution:** required on Free only ("denote Eleven Music"). Not required on paid plans.
- **Eligibility:** Starter / Creator / Pro are "For Individual Use Only". Scale is individuals or orgs with fewer than 10 employees; Business fewer than 50; Enterprise has no such cap.
- **High-quality downloads** (lossless WAV or 192 kbps MP3): no on Free / Starter / Creator; yes from Pro up. This is why bitrate must be detected or configured, not hardcoded.
- **Prohibited prompts:** artist/songwriter names, song or album titles, label/publisher names, distinctive copyrighted lyrics.
- Paid-plan Output can be used commercially indefinitely, subject to these terms, after the subscription ends.

The Music Terms table has no explicit "payg" column. **Rick must confirm this workspace's plan covers commercial music use in customer videos before this goes live.** That is the only open decision; it does not block drafting the skill and helper.

---

## 2. Test call result (already done — do not repeat it)

One short instrumental call was made on Nov 19, 2026 at 11:51 PM ET (America/New_York), as authorized for the earlier research.

- Request: `POST /v1/music?output_format=mp3_44100_128` with `model_id=music_v2_5`, `force_instrumental=true`, `music_length_ms=10000`, a generic electronic-pulse prompt (no artist names).
- Result: **HTTP 200**, `Content-Type: audio/mpeg`, `song-id` header present, **10.031 s**, 128 kbps, 160,540 bytes, returned in 3.31 s.
- Saved at `/workspace/music_test/instrumental_10s.mp3` (metadata: `/workspace/music_test/test_result.json`).
- Conclusion: this account **has Music API access**, and the request shape above works. The 128 kbps format was used only for that probe; the helper must detect or configure 192 vs 128, not hardcode 128. Implementers should not make another test call unless Rick asks.

---

## 3. How audio works today (what to keep)

- Voiceover (`film-pipeline.md` §4, `SKILL.md` "Voice"): free scratch TTS first (edge-tts) to time the film; then **one** ElevenLabs Flash TTS call for the whole script, two at most; word timings to `audio/words.json`; `audio/narration.wav` + `audio/timing.json`. No key → stop and report; never silently ship the scratch voice. Model `eleven_flash_v2_5`, `mp3_44100_128`, speed 0.85.
- Music today: **no reusable tool**. The producer writes a one-off numpy scorer per film, e.g. `<J>/audio/build_audio.py`, sometimes following the older GME `music.py` pattern (`/workspace/motion_kit/round2_cinematic/gme/music.py`). The score is timed to the story; the sound is a cheap synth; ducking in the GTA script is ~8 dB and must not be copied.
- Mix and contract to keep: `python3 $S/mix_soundtrack.py --project P --music audio/music.wav --stems` (`$S` is the cinematic-film scripts dir). Sidechain duck from the narration, two-pass loudnorm, true peak −1.5 dBTP, integrated target from `qa.md` (currently −15 ±1.5 LUFS). Stems (all master length, 48 kHz WAV): `narration`, `music`, `sfx`, `footage_audio` (if any), `dialog`. The editable package keeps using this same `audio/music.wav`.
- Mixer defaults (in `mix_soundtrack.py`, do not edit the file): `--music-db -6`, `--duck-ratio 4`, `--duck-threshold 0.025`, `--fade-in 1.2`, `--fade-out 3.5`.
- Craft ducking (`craft/sound.md`, `craft-standards.md`): music already down when the first word lands; **10–18 dB** under speech, ≥20 dB if the music has vocals (or avoid vocals under speech); ramps 200–500 ms in, 600–1500 ms out. No sung vocal under narration.
- Paid calls (`SKILL.md` Money, `RULES_FROM_RICK.md` §10.4): every paid call (TTS, generation, LLM) gets at most **2 attempts**, the second only after the first failure is understood. Write planned calls and estimated cost in the log first. Log every paid call; put the total in the final producer message. Customer-facing progress copy must never include $ amounts or vendor names (`RULES_FROM_RICK.md` §8.3).
- BYOF / customer-footage edits: no voiceover unless the customer asked; add a score only where it serves the footage. Do not force generated music onto a quiet BYOF edit that should have none.
- Customer-supplied or found track: still allowed if the customer provided music or the brief requires a specific track. Record the source. Do not replace a customer track with generated music.

---

## 4. The design to implement

### Cue list (producer-written, one per film)

The number of tracks follows the **story**, not the film's length: **one cue per mood section, maximum 4 per job**. Drop any rule like "one track under 3 minutes". A 60-second film with a turn may need 2 cues.

Each cue has:

| Field | Meaning |
|---|---|
| `start`, `end` | Seconds on the film timeline. Cues should cover the scored span without holes; a short overlap for the join crossfade is OK. |
| `prompt` | Style prompt for this section (mood, genre, pacing, instrumentation). |
| `bpm` | Tempo; required for bar-line loop cuts and useful for join points. |
| `drums` | Yes/no. Say "with drums" or "no drums" in the prompt as well. |
| `vocals` | See vocals rule below. |

Suggested file: `<J>/audio/music_cues.json`.

```json
{
  "film_duration_seconds": 60.0,
  "has_narration": true,
  "cues": [
    {
      "id": "open",
      "start": 0.0,
      "end": 32.7,
      "prompt": "Dark mid-tempo electronic underscore, tight kick and snare, muted bass, building tension, instrumental, no vocals.",
      "bpm": 100,
      "drums": true,
      "vocals": false
    },
    {
      "id": "turn",
      "start": 32.7,
      "end": 60.0,
      "prompt": "Same world, drums drop for the turn then a final resolving chord that can land on the last frame, instrumental, no vocals.",
      "bpm": 100,
      "drums": true,
      "vocals": false
    }
  ]
}
```

**Vocals.** Default is instrumental, no vocals, whenever the film has narration (`has_narration: true` or a narration stem exists). Set `force_instrumental: true` and say "instrumental, no vocals, no lyrics, no singing" in the prompt. Ignore or override a cue that asks for vocals on a narrated film, and log that. Use vocals only on films with **no voiceover**, and only when the film calls for it.

Write prompts from the treatment's music idea plus each section's mood. Give BPM and drums. For a cue that will be looped, ask for a loopable bed, not a one-shot finale. For the **final** cue, ask for an ending that can land on the last frame. Never prompt with artist names, song titles, or copyrighted lyrics. If the API returns `bad_prompt`, rewrite using any suggestion it includes; that rewrite is the second attempt of that cue's paid call.

### Generate length and looping

- Generate **each cue at its own length** (`end - start`).
- **Loop only cues longer than about 2 minutes.** For those, generate a **2–3 minute** track (not 60–90s), then loop it to the cue length.
- Cut loops **on bar lines** using the cue's BPM (4/4 bar = `4 * 60 / bpm` seconds), with a **short crossfade**.
- **Never fade out and back in** at the loop seam (no dip to silence between repeats). Use a true overlap crossfade (`acrossfade` or equivalent), last `C` seconds into first `C` seconds.
- **Trim the final cue** so its ending lands on the film's last frame. Never put a fade in the middle of a phrase. Prefer a bar- or phrase-boundary trim. A tiny click-safe fade (tens of milliseconds) at the file edge is OK; a 2–3 second fade that starts mid-phrase is not.

### Join, mix, ducking

Join the cues, in order, into one full-length `audio/music.wav`, **crossfading at the turns** (the cue boundaries). Same contract as now: 48 kHz stereo WAV, duration matching the film (within the existing ~50–200 ms audio tolerance), ready for:

```bash
python3 $S/mix_soundtrack.py --project P --music audio/music.wav --stems
```

Ducking is **not** done in `gen_music.py`. It is done by the existing `mix_soundtrack.py` sidechain, at the craft target of **10–18 dB**.

**Does the mixer need a parameter change from today's ~8 dB?** The 8 dB was **not** from `mix_soundtrack.py`. It came from the one-off GTA script, `duck=1-0.6*env` (music × 0.4 during speech ≈ −8 dB). That in-script ducking goes away.

`mix_soundtrack.py` already sidechain-compresses from the narration (`--duck-threshold 0.025` ≈ −32 dBFS, `--duck-ratio 4`, attack 35 ms, release 550 ms, `--music-db -6`). With a typical narration level, those defaults often already land in the **10–18 dB** range. **Do not change the mixer source.** Do this instead:

1. Call the mixer with explicit flags and measure the ducked music stem during speech vs gaps (existing `measure_mix.py` / stem listen).
2. If the measured duck is still under 10 dB, raise it with **call flags**, not a code edit: start with `--duck-ratio 6` or `--duck-threshold 0.015`. If it pumps or goes past ~18 dB, ease back toward the defaults.
3. **Do override `--fade-out`.** The mixer's default `--fade-out 3.5` (and `--fade-in 1.2`) would start fading 3.5 s before the end and can put a fade in the middle of the final phrase. The last cue is already trimmed to land on the last frame, so pass a tiny click-safe pair instead, e.g. `--fade-in 0.05 --fade-out 0.05`.

### Cache, retries, fallback, logging

- Save each cue's raw API audio, prompt, length, model, format, `song-id`, and estimated USD in `<J>/audio/music_src/` plus a JSON sidecar. **Never write the API key.**
- On a job retry or a mix-only rerun, **reuse cached cues**. A cache hit is not a paid call. Regenerate a cue only if its prompt, length, BPM, drums, or vocals must change.
- Paid-call rule still applies: at most **2 attempts per cue**, the second only after the first failure is understood.
- **Fallback to the current procedural synth** (a one-off `<J>/audio/build_audio.py` / numpy score keyed to the timeline) when:
  - the pre-call estimate would exceed about $2, or the remaining overall ~$5 job budget;
  - a cue fails twice;
  - a retry would itself exceed the $2 running total;
  - the key is missing (then also report it).
- Prefer falling back to a **full procedural bed** for that job, not a hybrid of ElevenLabs cues and synth cues, so the score stays one system. Keep any already-paid raw files in `music_src/` for the log; do not mix them into the shipped bed.
- Log in `log/job.md` before spending: cue plan, generated minutes, `estimate_usd`, cap. After each call: status, generated ms, running total, cache hit or miss. If falling back: the trigger (over cap / failed twice / retry would exceed cap / missing key). Put the music total in the final producer message. Progress updates stay Transovo-branded, with no vendor name or dollar amounts ("Scoring the film" is fine).

---

## 5. What to put in each file

### 5.1 `RULES_FROM_RICK.md`

Add a new item at the end of **§5. Voice and audio**, dated Nov 19, in Rick's voice (direct, short, "we", no vendor lecture). Suggested text, edit lightly for style consistency if needed:

> 5. **ElevenLabs music, not a one-off synth score.** For any film that needs a score, write a short cue list — one cue per mood section, at most four — and generate the music with ElevenLabs from each cue's style prompt, BPM, and drums, the same way the voiceover is prompted. Under narration the track must be instrumental; vocals only when there's no voiceover and the film calls for it. Generate each cue at its own length. Loop only cues longer than about 2 minutes, from a 2–3 minute track, cutting on bar lines with a short crossfade, never fading out and back in. The last cue's ending should land on the film's last frame, not a fade mid-phrase. Join the cues into one bed and duck under the voice with the existing mixer (10–18 dB). Cache generated cues and reuse them on retries. If generation fails, or the music would cost more than about $2, fall back to the current procedural synth so the job never stalls. Music spend runs automatically, like TTS. *(Nov 19)*

Do not rewrite older voice rules.

### 5.2 `SKILL.md`

1. In the hard-rules / principles list, **immediately after the Voice bullet**, add a **Music** bullet that states the same rule in skill language, and points at `film-pipeline.md` §6 and `scripts/gen_music.py`. Include: producer-written cue list, one cue per mood section, max 4, not "one track under 3 minutes"; instrumental under narration; generate at cue length; loop only cues longer than ~2 minutes from a 2–3 minute track, bar-line crossfades, no fade-out-and-back-in; final cue lands on the last frame; join to `audio/music.wav`; duck 10–18 dB with `mix_soundtrack.py`; cache on retries; ~$2 music cap computed as minutes × $0.15 before calling; procedural fallback if generation fails or would exceed the cap.

2. Tighten the **Money** bullet so "generation" includes ElevenLabs music, and so the **~$2 music cap** sits inside the existing ~$5 overall paid-call cap.

3. In **§6 Path C**, replace item 6 ("Sound: a score composed for this film…") with: generate an ElevenLabs cue-list score for this film (see `film-pipeline.md` §6), SFX on visual hits under the voice, then the same stems as today (`narration`, `music`, `sfx`, `footage_audio`, `dialog`), all the master's length, 48 kHz WAV.

4. Do not tell the customer-facing progress text to mention ElevenLabs or prices.

### 5.3 `film-pipeline.md` section 6 (Sound)

Keep item 1 (SFX) as it is. Replace item 2 with the procedure in §4 of this brief (cue list, vocals, generate length, looping, join, cache, cap, fallback). Keep item 3 (mix / stems / `mix_soundtrack.py`) but add the invocation flags:

- `--music audio/music.wav --stems`
- tiny `--fade-in` / `--fade-out` so the default 3.5 s tail fade does not sit mid-phrase
- if measured ducking is under 10 dB, `--duck-ratio 6` or `--duck-threshold 0.015`

Also a short pointer in §1 item 6 (`research/treatment.md` "music idea"): that idea is broken into the cue-list prompts, one per mood section.

Helper invocation example:

```bash
python3 <skill-root>/scripts/gen_music.py \
  --cues "$J/audio/music_cues.json" \
  --out "$J/audio/music.wav" \
  --raw-dir "$J/audio/music_src/"
```

The installed skill may live under `/home/box/agent-data/workflows/motion-studio-production/`. Prefer a path relative to the skill root in the docs, and mention both locations briefly.

### 5.4 `engines.md` and `craft/sound.md`

- `engines.md`: free path remains synthesised SFX (and scratch voice, Commons, yt-dlp). Synthesised/procedural music is the **fallback** when the Music API fails or the pre-call estimate would exceed about $2. Still never print the key.
- `craft/sound.md` §5: one short paragraph on cue-list ElevenLabs scores; ducking target 10–18 dB via the existing mixer (one-off synth beds had been ~8 dB); last cue ends on the last frame, no mid-phrase fade. Leave the rest of the sound craft as it is.

### 5.5 New helper: `scripts/gen_music.py`

A single Python 3 script, stdlib plus ffmpeg/ffprobe on PATH. No ElevenLabs SDK required (`urllib` is enough). Never print, log, or write the API key (not in meta JSON, not in exceptions, not in ffmpeg command traces).

**Inputs (CLI):**

| Flag | Required | Default | Meaning |
|---|---|---|---|
| `--cues` | yes | | Path to the cue-list JSON |
| `--out` | yes | | Full-length 48 kHz stereo WAV (`audio/music.wav`) |
| `--raw-dir` | no | next to `--out`, `music_src/` | Cached raw API audio + per-cue JSON sidecars |
| `--crossfade-ms` | no | one bar if the outgoing cue has BPM, else 1000, and never more than a small fraction of either cue | Join and loop seam length |
| `--output-format` | no | `auto` (detect / configure; see below) | `mp3_48000_192`, `mp3_44100_192`, `mp3_44100_128`, or `auto` |
| `--model-id` | no | `music_v2_5` | |
| `--dry-run` | no | | Print planned cues, generated ms, `estimate_usd`, chosen format, then exit. No API call. |
| `--reuse-only` | no | | Assemble from cached raw files only; error if a cue is missing. |

Read the key from `ELEVENLABS_API_KEY` in the environment. If unset, the script may load `/workspace/secrets/motion_production.env` or a `--env-file` without printing values. If still unset: exit non-zero with a short "ELEVENLABS_API_KEY is not set" message (the producer then falls back and reports it).

**Bitrate (do not hardcode 128).** Prefer 192 kbps when the plan allows it (`mp3_48000_192` is what `auto` already selects for v2 / v2.5; `mp3_44100_192` is also fine). Otherwise 128 (`mp3_44100_128`). Resolution order:

1. `--output-format` if the caller set an explicit codec (not `auto`).
2. Else env `MOTION_STUDIO_MUSIC_OUTPUT_FORMAT` if set.
3. Else try 192 first (`mp3_48000_192`). If the API rejects the format (typically 422 / a tier or format error) with **no audio body**, retry that same cue at `mp3_44100_128`, remember 128 for the rest of the job, and do not count the failed format attempt against the $2 cap.
4. Do not make a separate paid probe generation just to test format.

**Pre-flight cap.** Before the first compose call, compute `estimate_usd` as in §1. If it is over about $2, exit with a clear "over cap" status and the estimate so the producer can fall back. Do not start a partial paid run.

**One HTTP attempt per cue per process** (the producer owns the second attempt and the logging). On success, write raw audio to `--raw-dir`, plus a sidecar: cue id, prompt, start/end, bpm, drums, vocals, generated ms, model, format, song-id if any, HTTP status, byte size, duration, estimated USD, timestamp. No secrets. Skip the API when a valid cached raw for the same cue identity (prompt, length, bpm, drums, vocals, model) already exists.

**Per-cue audio, then join:**

1. Probe the raw file; decode to 48 kHz, 2-channel WAV.
2. Short cues (≤ ~2 min): trim or pad to the cue length on a bar line when BPM is known. No loop. No mid-phrase fade.
3. Long cues (> ~2 min): trim the 2–3 min generate to a whole-bar loop body, then loop to the cue length with a short **bar-line** `acrossfade`. Never fade out to silence and fade back in.
4. Final cue in the list: trim so the end lands on `film_duration_seconds` / the film's last frame. No fade in the middle of a phrase.
5. Concatenate cues in order with a short `acrossfade` at each turn. Write `--out` as 48 kHz stereo PCM WAV, duration within 50 ms of `film_duration_seconds`.
6. Print one status line per cue and one for the join: paths, generated vs cue seconds, looped or not, estimated USD, running total, song-id if any. No key, no full prompt dump (a character count is enough).

**Local checks with no further paid calls:** `--dry-run` on a 2-cue 60s list and a 4-cue 20-min list (confirm estimates ~$0.15 and $1.20–$1.80, and that a 20-min unlooped plan would be rejected as over cap). Missing-key error path. Assemble/loop against the existing `/workspace/music_test/instrumental_10s.mp3` as a stand-in raw file if useful, then ffprobe the output duration.

---

## 6. Open decision for Rick

**Confirm the ElevenLabs plan covers commercial music use for customers before this goes live.** The workspace is active `payg`; the Music Terms table has no "payg" column. Starter+ commercial rights (with the film / TV / radio / studio-game exclusion, no stock-music library, and "individual use only" on lower tiers) may or may not be what this SaaS account actually has. Drafting and merging the skill can proceed; production use of generated music in customer videos should wait on this confirmation.

Everything else in the earlier brief is now decided: cue counts follow the story (max 4), not the runtime; vocals are instrumental whenever there is narration; 192 kbps if allowed, else 128, detected or configured; spend runs automatically like TTS under a ~$2 music cap, with procedural fallback so a job never stalls.

---

## 7. Out of scope

- No production deploy, no push, no merge.
- No change to Modal, Coolify, or the coordinator.
- No source change to `mix_soundtrack.py`, stem names, or the editable audio contract (invocation flags only).
- No further paid music test unless Rick asks.
- Do not silently ship procedural music when the API works and the estimate is under the cap.
- Do not mention licensing, rights, or vendor names in customer-facing progress text (`SKILL.md` "No licensing work" and `RULES_FROM_RICK.md` §8.3).
