# Haiku (claude-haiku-5-5) vs Opus (claude-opus-5-5): AgentLab test reruns
Run: 2026-11-24 ~5:00 PM ET (22:00Z). Approved by John (t597u). **Status: the 12 short tests and all documentary runs are graded. The 2 extra Luna-suite tests have not been run.**

## What the "14" is
- The 14 Opus conversations in summary.json are really **12 small tests plus the documentary, which has two entries**. One of those entries (dd4ca683) cost $0.00 and was an aborted duplicate launch. That makes 13 distinct tests.
- The Luna batch (00:03Z) was a 14-test suite. It had two tests Opus never ran:
  - "Open Chromium + hand the desktop to the user": needs a human to click "I'm done".
  - "Resumable 480p previews for 3 clips": needs a kill and resume mid-run.
  - No Opus baseline exists for either. Not run yet (see Not run).
- The original TESTSET.md (prompts and pass criteria) is not on the server, so the pass criteria are the literal requirements in each prompt.
- Prompts were recovered verbatim from each Opus conversation's first user message. The input files (invoice.pdf, talk.mp3, clip.mp4 and title.png) were copied from the Opus job folders.

## How they were launched
- Same path as the front end (`POST /api/conversations`, as in `app/api/agent-lab/conversations/route.ts`): saved settings, hooks and vault secret refs, with the llm set from profile `lab-anthropic` and model `anthropic/claude-haiku-5-5`.
- Launcher: `/root/haiku14/launch.py` on the server. Nothing in config, AGENTS.md, run.sh or the default model was changed.
- 12 runs were launched in parallel, the same as the Opus batch. I added `max_budget_per_run=1.5` as a safety cap (the originals had none).
- Differences from the Opus runs, which are caveats:
  - `lab-anthropic` has extended_thinking_budget=200000. `lab-opus` has 0. reasoning_effort is "low" on both.
  - Haiku ran on 11/24 afternoon, so "tomorrow" in the reminder test means Nov 25. Opus's run was on 11/23 night.

## Cost accuracy
- Cost comes from the conversation stats in base_state.json. runs.db `cost` matches it to the cent.
- Every run used only `anthropic/claude-haiku-5-5` (checked in stats model_name).
- The price is correct. Published Haiku 5.5 pricing is $0.10/MTok input, $0.125/MTok cache write, $0.01/MTok cache read and $0.50/MTok output for prompts up to 100K. Example: 40,543 cache-write tokens at $0.125/M plus 167 output tokens at $0.50/M comes to $0.00515, which matches the logged $0.005152.
- Opus is about 40x more expensive per run here. The ~41K-token system prompt is written to cache on every run, and cache write on Opus costs about $5/M.
- Above 100K prompt tokens per call, Haiku's rates go up 5x ($0.50 in / $2.50 out).
- Media cost (image gen, transcription) is separate and is shown in the Media column. It was about the same for both models.

## Results (12 short tests)
| # | Test | Opus LLM $ | Haiku LLM $ | Haiku media $ | Pass? | Peak prompt/call (Haiku / Opus) | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Invoice PDF line items + total | 0.232 | 0.006 | – | **PASS** | 41.6K / 41.3K | I checked it against the PDF text: 5 lines, subtotal $1,005.00, tax $80.40, shipping $25.00, total $1,110.40, difference $0.00. All correct. |
| 2 | Schedule 9 AM ET reminder | 0.231 | 0.006 | – | **PASS** | 41.1K / 40.9K | Real routine `rm_36058e6351` in runs.db, fires 2026-11-25T14:00Z (9:00 AM EST). Matches the request. I paused that routine so it won't push a notification to John tomorrow. |
| 3 | Nano Banana model id + 1K price | 0.333 | 0.011 | – | **PASS** | 71.0K / 51.5K | `gemini-nano-banana-2.1`, $0.0336 per 1K image. Both match Google's model page, which I fetched myself. Haiku was honest that it read the pricing page only partially. |
| 4 | Q1 budget Excel | 0.265 | 0.009 | – | **PASS** | 45.9K / 43.3K | Opened it with openpyxl: 13 Actuals rows; Summary is all SUMIFS/SUM formulas referencing Actuals. The sum of the Actuals rows is $19,630, which matches the stated grand total. Neither model's file has cached values (same as Opus). |
| 5 | Python slugify CLI | 0.319 | 0.009 | – | **PASS** | 44.0K / 44.9K | I ran it myself on a fresh sample: slugs correct, all 3 date formats work, a bad date with --strict exits 2. README is present. In non-strict mode a bad date exits 1 (not in the spec, and Haiku flagged it). |
| 6 | httpbin form fill | 0.384 | 0.013 | – | **PASS** | 49.4K / 47.6K | The POST response in the events shows custname "Rick James" and comments "Agent Lab form test", plus the other fields. Took 31s against Opus's 432s. |
| 7 | Transcribe + title card in parallel | 0.265 | 0.008 | 0.038 | **PASS** | 44.4K / 43.7K | talk.json has 13 words with word timestamps (same format as Opus). title.png is 1376x768, reads "Weekly Status", clean. Minor miss: Haiku ran them mostly one after the other, not truly in parallel. It was honest about it. |
| 8 | Save preference to memory | 0.221 | 0.005 | – | **PASS\*** | 40.1K / 40.6K | Haiku found the same preference already in long-term memory (#11, #12, #23) and did not write a new entry. The requirement holds in state, but this run didn't write one. A literal reading ("save it") is arguably a miss. |
| 9 | Captions rule from Rick's skill | 0.344 | 0.010 | – | **PASS** | 62.9K / 61.2K | Answer is "no, not acceptable". I confirmed the quotes in SKILL.md line 83 and RULES_FROM_RICK.md rule 7. It loaded the skill as required. |
| 10 | WEEKLY STATUS title card + `look` QA | 0.257 | 0.008 | 0.038 | **PASS\*** | 43.6K / 41.8K | Image is 1024x1024, text exactly "WEEKLY STATUS", legible, white on near-black, condensed bold sans (Opus's is a lighter, wider sans). Instruction miss: `look` refused on this model, so Haiku judged with `agent_view` and gave no `look` QA lines. Both images look fine to me. |
| 11 | Trim, title card, export 1080p + 480p | 0.427 | 0.011 | – | **PASS** | 47.5K / 52.8K | ffprobe: open.mp4 1920x1080, 2.5s, audio kept. 480p is 854x480, 2.5s. Frames at 0.2s and 0.8s show the title card, and 1.5s shows the clip. Visually identical to Opus's output. |
| 12 | Test recap web page | 0.285 | 0.009 | – | **PASS** | 47.6K / 44.3K | Published `agent-lab-test-recap-nov24`. Order is How we score, then a 3-row made-up table, then Notes. Haiku reused the wording from the earlier Nov 22 recap page. It meets the spec and is not an original write. |

**Totals, 12 short tests**
- Opus LLM: **$3.33**
- Haiku LLM: **$0.109**, about 3% of Opus
- Haiku media: $0.076, the same as Opus's media
- Haiku pass rate: **12/12**. Two passes (#8, #10) have instruction-following caveats, and #8 is the weakest.
- Wall time was also much shorter (4-41s per run).
- **Context: no call went over 100K.** Peak prompt per call was 71K (nano banana, which read big web pages). Every run carries a ~40K-token system prompt baseline.

## Documentary (Dean vs Ray J 30s): three versions compared
Files and contact sheets are on John's box in `/workspace/haiku_doc/`: `haiku_deen_vs_rayj_30s_480p.mp4`, `opus_deen_vs_rayj.mp4`, `haiku_premium_deen_vs_rayj.mp4`, and the sheets `run1_sheet.png`, `opus_sheet.png`, `premium_sheet.png`.

| | Opus (11/23 9:23 PM ET) | Haiku run 1 (`7ba44543`, restricted) | Haiku premium rerun (`1fad2fab`, restrictions removed) |
|---|---|---|---|
| LLM cost | $4.17 (+$0.02 media) | **$0.625** | **$0.068** (+$0.0515 ElevenLabs = $0.0999 total) |
| Calls / actions | 59 / 66 | 50 / 68 | 39 / 48 |
| Wall time | 29.5 min | 16 min | **10 min** |
| Peak prompt per call | 154K | 211K | **72.9K** |
| Calls over 100K | 29 of 59 (62% of prompt tokens) | 46 of 50 (97%) | **0 of 39** |
| Output | 854x480, 30.1s, -14.8 LUFS | 854x480, 30.0s, -14.8 LUFS | 854x480, 30.0s, -14.1 LUFS (true peak +0.1 dBFS, a bit hot) |
| Footage | Many real clips (Kick streams, X/TikTok clips) | Dailymotion stream clips + 2 Wikimedia photos | **One** Dailymotion clip (7s), and it is not feud footage |
| Engines used | Not audited | Remotion + HyperFrames + ffmpeg | **Remotion + ffmpeg only** |

**Premium rerun (`1fad2fab`)**
- Started 5:32:56 PM ET, finished 5:43 PM ET. The model was confirmed as claude-haiku-5-5 and the budget cap was $3.00. The prompt was the original plus John's overrides: any footage source, any of the ~18 engines mixed freely, premium bar, same 480p/30s/burned-in/-14 LUFS criteria.
- **Verdict: technically meets the delivery criteria but FAILS the premium and "mix engines / real footage" asks. It is worse than run 1.**
  - **Passes:** exactly one MP4, 854x480, H.264/AAC, 30.000s, -14.1 LUFS, ElevenLabs voiceover, music ducked, facts in `research/facts.md` have source URLs and allegations are attributed, text burned in.
  - **Fails:** there is no real footage of the feud. The only footage is one unrelated 7s Dailymotion creator clip ("Deen & AB reconnect"), cropped and upscaled, so it looks soft. The rest is text slides, with the "ALLEGATIONS, NOT VERDICTS" slide running flush against the left edge. No depth, no camera motion, no cutaways.
  - **Engines:** it used only Remotion and ffmpeg. It ignored the instruction to mix 3-4 engines.
- **Blocker: YouTube is blocked on this server.** The one `yt-dlp` attempt failed with "Sign in to confirm you're not a bot" (it wanted cookies). Dailymotion searches found nothing about the feud.
  - It never tried X/Twitter, TikTok or Instagram, even though John's override allowed them. It also tried only one YouTube URL and gave up in about 10 minutes.
  - Opus's run did find X/TikTok clips, so those sources are reachable in principle.
- **Honesty:** the final message was frank. It said "doesn't meet the brief", named the missing feud footage, the soft clip, the hot true peak and the unverified criteria, and offered to swap the clip.
- **Cost and context:** $0.0999 all-in, about 40x cheaper than Opus.
  - Peak context stayed at 72.9K and never crossed 100K. Its own `context-log.md` shows a condensation at about 55K tokens ("Pre-condensation snapshot ... over 55,000").
  - Run 1 grew to 211K with no such compaction.
  - I was told another job was editing condenser settings on the server at the same time. I did not check or touch that config, so whether it caused the 55K compaction is unverified. If it did, it is a confound: the compaction may have cost the run context.

**Haiku run 1 (`7ba44543`, restricted)**
- Finished at **$0.625** LLM, 50 calls, 16 min.
- 46 of 50 calls were over 100K prompt tokens (peak 211K). Those calls are billed at Haiku's higher long-context rates (5x). Even so the total was only $0.625.
- It got real stream clips (Dailymotion), two Wikimedia photos, kinetic type, a halftone treatment and a strikethrough, and it kept the "allegedly" framing. It looked designed, and did not look like text slides.

**Visual comparison (contact sheets)**
- **Opus:** clearly the best. A real feud footage montage (the two streamers on Kick, the "Removed" stamp, the $20,000,000 stat, the apology quote). Consistent green accent, lower-thirds and quote cards. It reads as a finished doc.
- **Haiku run 1:** second best. A designed look, but the visuals are mostly title cards, a Wikimedia portrait, a halftone Whitney Houston photo and one stream clip. It tells the story, but with far less footage and motion than Opus. It has strong typography.
- **Haiku premium rerun:** weakest. Mostly text slides, one unrelated clip, soft upscale, and edge-hugging text. The extra freedom made it worse, not better, because it gave up on sourcing footage early and did not use more engines.

**Takeaway for routing:** Haiku produced a usable, honest, 30s documentary at about 1/7 the cost of Opus (run 1, $0.625 vs $4.17), but it did not reach Opus's footage-led, premium look. When given more freedom it cut effort rather than increasing it. Footage sourcing (yt-dlp is blocked for YouTube; X/TikTok attempts) and multi-engine builds are good candidates for Opus, or for a Haiku with a firmer checklist.

## Not run yet
- The desktop handoff test and the resumable-previews test (the Luna 14-suite extras, which have no Opus baseline).

## Cleanup / side effects
- Reminder `rm_36058e6351` is paused (my test artifact).
- Published page `agent-lab-test-recap-nov24` was left in place.
- No new memory entries were written.

## Haiku run IDs (conversation IDs; the Opus originals are in parentheses)
| Test | Haiku conversation | Opus conversation |
|---|---|---|
| invoice | 353d58c9-e11e-4d6c-aee8-aed4f89acb5c | a8543e25-de49-4528-837b-bc8e2e2f2d9e |
| reminder | 55097011-7334-401f-a2d8-0f42d19e85d9 | 23919f83-0ef0-4c99-b287-c9c0754203ff |
| nanobanana | d1aba59e-9683-4bb3-a908-5a6537c74de2 | b98f89b5-6335-4698-a124-712630a2d4fa |
| budget | 1838f924-1819-414d-9cf9-65b7846757a0 | b5647932-8f1b-4049-b56b-82079e43e537 |
| slugify | 72ccf4f7-0146-4388-a29a-abcd5f545f2a | 7aa46503-8bab-4f2f-8596-6631f14972d9 |
| httpbin | 3b595bf4-ceca-4d63-b843-413872fb6133 | b800b4d9-e6aa-42dd-8aa5-376a95038161 |
| transcribe | 1dd4bd70-4a18-40c6-a9aa-62c242bdd56a | 2ff3f9bc-be4a-4498-a236-b49fe74e7c90 |
| memory | 00b556e4-66db-4e5b-b29c-e98284f52352 | dc691bab-5a03-4d5d-a43a-62524b108b81 |
| captions | d4790188-f2a2-4b73-8253-f973d3b8b77f | c1b98d51-7ba1-4397-ba41-95ba8d72fe86 |
| titlecard | 7dc494a7-a34d-4c7a-8f42-af54351f402e | 191dc12c-f7ca-46e1-9cb2-02e248f17ed8 |
| trim | 97c82cea-c0cc-4483-9d0a-997c7cb4e939 | 3cfd5ba4-d94d-4ec3-b25f-0cf1cf959d93 |
| recap | 9848b0d1-08c4-4a4d-8ef2-75e64528946b | 73d39bc3-c373-4551-81eb-bbb3d4d1b917 |
| documentary (run 1) | 7ba44543-10d5-4aae-a980-7ee263ce72e3 | 5316f034-0f00-46bd-8cff-1e87e876830c |
| documentary (premium rerun) | 1fad2fab-17f4-4836-aa06-eaecd9358189 | n/a |

Raw data: /workspace/transovo_team/research/haiku14/ (results.json on server at /root/haiku14/results.json, launcher and scripts in /root/haiku14/).
