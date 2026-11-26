# transovo-agent-lab

## Summary

(none yet)

## Notes
- 2026-11-23 00:00 UTC (job memtest): Phase 2: memory, skills, job isolation built.
- 2026-11-23 02:33 UTC: Resumability test job (0ed39ef9, Nov 22 21:25 ET): 3 clips a/b/c -> 5 s 480p previews. Run killed mid-job after all three rendered; on restart a/b skipped via markers+ffprobe, c re-rendered because 119 frames and 4.963 s metadata. Fix: trim=end_frame=120 + atrim=0:5 + -r 24000/1001 -fps_mode cfr. Script at work/process.sh, all outputs verified 854x480/120 frames/5.005 s/faststart.
- 2026-11-23 02:45 UTC: Nov 22 test job b31cb356: trim clip.mp4 first 3s + full-frame title card (src/title.png, 1024sq scaled to 1370 and padded to 1920x1370 then cropped, bg #121216) for first 1.0s -> 3.500s open.mp4 + 480p preview. Verified: cut exactly at frame 30, audio corr 1.0 vs source 3.0s. Note: out/weekly-status.png did not exist; src/title.png existed.
- 2026-11-23 03:36 UTC: Nov 22 22:35 ET: one-page Agent Lab test recap published -> slug agent-lab-test-recap-scoring (https://transovo.ai/app/agent-lab/pages/agent-lab-test-recap-scoring). Order: how we score (pass/fail, quality 1-5, time, cost) -> made-up 3-row table (7 cols) -> notes. Verified with Playwright full-page shot + look: 1280x2069, table 3 rows/7 cols, no cut-off text. Stray earlier slugs from same file: agent-lab-test-recap-nov22 and -nov22-2 (publish auto-suffixes on republish).
- 2026-11-23 07:50 UTC: Nov 23: daily 8 AM ET failure report routine rt_7410a44ae0 + skill agent-lab-run-failure-report. First scan: 59 runs, 0 status=failed, 2 retried (reminder restart, Dean vs Ray J: search-tool-not-found + 2x MaxIterationsReached), 5 stopped (all user Pause/Interrupt; clip job had full deliverables in out/).
- 2026-11-23 08:53 UTC: Nov 23 2:55-3:55 AM ET: Motion Studio Custom-flow + cancel UI test BLOCKED. 4 jobs (msp_5431a89f, msp_c9988a96, msp_d53bb21a, msp_0347c7dc) all failed in phase research/progress 0 before reaching running. Report: out/REPORT.md + page motion-studio-no-running-jobs-final. Found: UI cancel requires project status planning/producing/exporting; project-cancel POST works even on failed jobs and wrongly rewrites status (state bug); job msp_df813b3b stuck running 59h.
- 2026-11-23 10:22 UTC: 27B vision hosting research: free Gemini API (gemma-4-31b-it) proven 3/3 PASS with 3 failing negative controls; cheapest paid = DeepInfra gemma-3-27b-it $0.028/1k req; self-host floor = Vast RTX 3090 $0.122/hr, only wins >4,357 req/hr with batching. No cloud creds so no paid pod was started; nothing left running. Report: pages/27b-vision-hosting-2
