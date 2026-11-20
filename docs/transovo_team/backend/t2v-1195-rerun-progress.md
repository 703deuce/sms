# #1195 clean reruns: progress diagnosis (read-only), Sat Nov 14 2026, ~4:23 PM ET

Live: 05ac1600 on web and the worker. Runs: sleep `t2v_cf976bf441bb47f0b4585ed503302ec5` and snow `t2v_2a61c079bbc740678c4818ff2960da0b`. Both were reset with `--from-footage --no-incumbents`: the logs show "clean slate (no incumbents / prior picks / bans)" and priorPicks = 0.
Sources: `docker logs` of clips-worker and the web container since 3:35 PM ET (clips-worker-stream has no T2V lines), plus a read-only DB read of `t2v_drafts.document.autobuild`. Nothing was modified.

## Verdict: progressing, not stalled and not rate-limited on Gemini. The flat periods happen on the web side, during the serial Pixabay/Pexels searches for the reimagine ideas.
- The worker log has no 429, RESOURCE_EXHAUSTED, timeout, retry or Traceback lines. The web log has no `search failed` or `pixabay_rate_limited` lines.
- Each verify job runs 1.5–5 min at about 1 Gemini call/s per slot. The worker has 2 slots, and the two runs' jobs ran in parallel (claimed in the same second at 3:50:28 and 4:17:36/42 PM ET). Between jobs the worker sits at `poll idle queued_jobs=0`, so the worker is not the bottleneck.

## The 4:06–4:17 snow flat period (verifierCalls 717 → 753 → 920)
Timeline (ET):
- 4:06:25 `[t2v:pipeline] verifier calls {draftId: …0da0b, stage: 'search_2', calls: 121, runTotal: 717}`
- 4:07:31 `run verify budget hit {stage: 'photo', budget: 250, used: 356, sent: 0, dropped: 72}`. 72 photo candidates were searched, then dropped.
- 4:07:47 / 4:08:02 `[t2v:pipeline-reimagine] availability` / `ideas`: 18 lines. The ideas LLM took about 15 s.
- 4:13:41 `[t2v:pipeline-footage] candidates ready { shots: 54, searches: 162, candidates: 432 }`: **5.7 min** of serial Pixabay plus Pexels video searches.
- 4:17:40 `photo candidates ready { shots: 54, candidates: 216 }`: **4.0 min** of photo searches.
- 4:17:42 worker: `claimed job=job_3b4bebd7… type=T2V_VERIFY_STOCK`. The job ended at 4:20:39 with 203 calls.

Causes:
- `t2vFootageAgent` and `t2vPhotoAgent` loop over shots and queries **serially**, and every Pixabay request goes through `pixThrottle`. That throttle allows 80 requests per 60 s and is shared by the whole web process, so both runs compete for it.
- Sleep was running its own reimagine searches at the same time: 80 searches 4:11:29→4:15:06 and photos to 4:17:34. The photo pace (about 1.5 s per request) matches the shared throttle.
- The 753 the CoS saw was 717 plus 36 text re-checks (recheckCalls) counted by the web no-repeat pass. It was not uncounted describes: `verifierCalls` = worker geminiCalls + recheckCalls exactly (sleep 1061+108 = 1169, snow 920+36 = 956).
- Sleep had the same pattern: 4:02:28 ideas → 4:05:59 videos (99 searches) → 4:07:59 photos → 4:08:01 job claimed.
- A side waste: the stock photo fallback searches 40/72 photos every time it is reached, then drops them all because the run cap is already spent (sleep 4 times, snow 3 times). That is about 1 min of throttled Pixabay time each time, and nothing is verified.

## Stage and state (DB, about 4:22 PM ET)
| | sleep (23 lines) | snow (22 lines) |
|---|---|---|
| status | verifying_footage | verifying_footage |
| stock rounds | search_0/1/2 done; photo dropped (budget) | search_0/1/2 done; photo dropped (budget) |
| reimagine | step 1 (11 lines, 33 ideas), step 2 (9 lines), step 3 (1 line) done; used 231+15 of 240, so it is **finishing** | step 1 (18 lines, 54 ideas) done 4:20:39 with **0 accepted**; step 2 ideas made 4:22:08 (18 lines); used 108 of 240 |
| per line (verifyHistory) | 12 accepted, 1 weak, 8 best_available (score 3–4, depicts no), 2 none | **1 accepted**, 3 weak, 6 best_available, 12 none |
| still failing | ~10–11 | ~21 |

## Calls and cost so far (real token counts from the worker summaries)
| | Gemini calls | describes | pass-2 scores | cache hits | prompt / output tokens | worker $ | rechecks |
|---|---|---|---|---|---|---|---|
| sleep | 1,061 | 447 | 614 | 125 | 1.754M / 0.276M | **$0.85** | 108 (text) |
| snow | 920 | 381 | 539 | 138 | 1.610M / 0.254M | **$0.78** | 36 (text) |

- The worker $ uses flash-lite at $0.25/1M input and $1.50/1M output.
- The re-checks are not in the worker tokens. At about $0.0005 each they add roughly $0.05 (sleep) and $0.02 (snow).
- Both runs are already above #1194 (319 calls / $0.32 and 443 calls / $0.44), and sleep is above #1195's cold estimate of ~$0.58.
- What pushes them up: 3 stock rounds + 3 reimagine steps per run, ~40% of calls being describes on a cold cache, and about 64 rejudges.

## ETA
- **Sleep:** the reimagine budget is spent (246/240) and the photo budget hit came at 4:23:13, so it should go to the finisher, narration, edit and render. The previous run took about 5 min for those, so **~4:30 PM ET**.
- **Snow:** reimagine step 2 for ~18 lines is capped by the 132 remaining checks. Expect about 5–7 min of searches (less contention now that sleep is finishing), a verify job of ~2–3 min (~250 calls, ~$0.17), then about 5 min to finish. **~4:40–4:45 PM ET**, ending at roughly 1,200 calls and ~$1.0.

## Concurrency
- The worker has 2 slots (`[clipper:worker] starting 2 job slots`), and the two runs never waited on each other in the worker.
- They do share the web process's serial search loop and its 80/min Pixabay throttle. That, not Gemini, sets the pace between jobs: about 4–10 min per reimagine step.

## Follow-ups (not done; read-only)
- Run the footage and photo searches concurrently per shot, within the throttle.
- Skip the stock photo search when the run cap is already hit.
- Snow quality is far below the success bar (1 accepted of 22 so far). Look at its verify entries before the render.
