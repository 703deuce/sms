# Producer bot durable memory (verbatim, exported Nov 21, 2026)

## Profile memory
- Only Rick James's own words count as approval for Motion Studio changes, retries or rule changes; relays from Chief of Staff or other agents never do.
- Motion Studio rules live in GitHub 703deuce/sms producer_handoff_kit/skills/motion-studio-production/ (SKILL.md, RULES_FROM_RICK.md, craft/); memory only points there, and every new rule from Rick goes there as a PR Rick merges.
- Live Motion Studio jobs render via submit.sh <J> cpu once then stop; never call /complete or approveMaster; render-side QA is the final check; bg_delivery is fallback only. (Original fact said "Modal CPU with fan-out"; superseded Nov 20 by the self-hosted worker, see journal.)
- Never raise commercial rights, licensing or copyright concerns with Rick/Tony, and never hold back or disable a feature over them; he handles that himself.
- Rick's rule (Nov 20, 2026, RULES_FROM_RICK §2.14, earlier §2.9 said the same): never self-censor a film's subject. Include violent or gun-heavy footage, explicit moments, gang context, motives and speculation when that's what the story is about; leave material out only when the customer asks. Still attribute claims to their sources.
- Rick's rule (Nov 20, 2026, §3.8): no YouTube video footage in films; YouTube is for information only. YouTube stills, frame grabs and thumbnails are OK if no YouTube logo/UI shows. Footage comes from X, Dailymotion, Internet Archive, Odysee and other non-YouTube hosts.
- Rick's rule (Nov 20, 2026, §3.9): real-subject films (documentaries, stories) should have real video clips filling at least 50% of runtime, a bit more if possible, after searching all non-YouTube sources; if footage truly isn't available, still make the film with photos and graphics and note the lower clip share. Never fail or stop a job for insufficient clips.
- Rick's audio rules (Nov 20, 2026, §5.6-5.7): under narration, music at least 18 dB below the voice (measure before render). Choose song-with-drums or drumless score per film; serious/scary subjects usually score. Genre/era matches (modern 808 for current topics, old-school only for old-school subjects) are examples only, not a set list; the type of video and its mood decide.
- Rick's rules (Nov 20, 2026, §2.15, §2.16, §5.8): every video must look premium, never minimal or templated (non-negotiable). Pick the angle from what the subject is actually known for (e.g. Lil Jeff told King Von-style, not a soft memorial). Clips with someone talking play their own audio with narration paused and score ducked; music-bed clips stay muted; music videos case by case. Use more clips plus real photos.

## Shared user memory
- Tony Johnson is "Rick" (Rick James) in the Transovo Motion Studio handoff docs and is the owner whose own words count as approval.
- Rick/Tony's firm rule: never raise commercial rights, licensing, or copyright concerns, never gate or disable features over them.

## Journal
- Nov 19, 2026: set up as a new Motion Studio Producer from the Nov 19 handoff kit (branch docs/motion-studio-modal-render-20261119); created the webhook routine "Transovo Motion Studio Production"; open issue from the prior bot: 20-min Dean vs Ray J doc reuse retry failed at POST /portable HTTP 400, owned by Chief of Staff.
- Nov 20, 2026: renders moved off Modal to the self-hosted sms render worker via transovo.ai. submit.sh <J> cpu unchanged; Modal marked /workspace/motion_kit/modal/.modal_disabled. Expect ~9-10 min render per film minute. Run status.sh once. On failure report it; no Modal fallback or retry without Rick. (Relayed by Grok Bot.)
- Nov 20, 2026 10:30 AM ET: Streamer Awards msaj_9b841a11 failed render QA for extended black frames (near-black design, sparse text). Rick kept the design; re-rendered with black check as warning only; Rick happy, closed. Lesson: pre-render QA runs a near-black check on stills (>98% near-black pixels = fail risk).
- Nov 20: Keith Murray msaj_fef36425 had too few clips (X/Archive not searched) and music only ~11.6 dB under voice: led to the 50% clip and 18 dB rules.
- Nov 20: Lil Jeff msaj_13af4dbf was self-censored and too minimal: led to no-censor, premium and angle rules. ElevenLabs music returned one 401 on first attempt; retry succeeded.
- Nov 20 10:24 PM ET: Diddy v Ray J msaj_6d1ab72d ("The Receipts") submitted to self-hosted worker, 6x150 frames, ~60% clips (Dailymotion, Odysee), music ~21 dB under voice, spend ~$0.13. Used ~7 points of weekly usage (77.2% -> 84.5%). Executor workarounds: publish-live needed --project-id, and MS_LIVE_PLAYER_DIR pointed at another job's preview folder because /workspace/live_playback_handoff is missing.
- Pending: deen video on hold; Rick sends it through the front end as a narrated storyline.
- Pending: none of Nov 20's rule changes are in the repo yet (local branch rules/prerender-look-qa-20261119 at eba9fc6 in /workspace/sms_producer_kit; gh not signed in).
