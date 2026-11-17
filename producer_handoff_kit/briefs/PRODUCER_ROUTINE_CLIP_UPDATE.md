# Producer routine update — accept clip_and_finish and finish_clip

Do **not** apply this from here. The Motion Studio Producer bot (`90ec9cce-fbb8-4a0f-afc9-8e9a6ddcd0f2`) owns the webhook routine **Transovo Motion Studio Production** (panel id `motion-studio-job-intake`). This subagent cannot edit routines. Have that bot, or Rick’s main assistant with UpdateRoutine, `get` the live prompt and patch it.

Live prompt was not readable from this environment. Last confirmed state (from the producer’s own chat, 16 Nov 2026, after Rick’s “Yes, go live” and the standing media/licensing/Flash rules):

- Live mode: on a webhook with a `jobToken`, run the Motion Studio production skill end to end, report progress, and message Rick in that bot’s chat when a job starts, is delivered, or fails.
- Always pull real photos and clips of the actual subject, even when `webResearch` is false or `mediaPolicy` is `uploads_only`, unless the prompt itself restricts media.
- No licensing, rights, or font caveats unless Rick asks on that job.
- ElevenLabs narration uses `eleven_flash_v2_5`.
- Hard limits still on the routine, and **not updated since**: about US$5 per job, 2 attempts per paid call, and **Cinematic-only**. Later mixed-engine work was done as direct tests with instructions like “don’t touch the Cinematic-only routine.” `revise_video` was also never added to the routine after Agent Bridge v2 landed.

The routine therefore still needs a clip-action patch (required for this launch) and, separately, a film-path refresh (Cinematic-only and missing `revise_video`) that should be confirmed against a live `get` before changing those lines.

---

## Required patch (clip jobs)

**1. In the sentence that lists accepted webhook actions or fields, add the two clip actions.**

If the prompt says something like:

> On each webhook, run the full Motion Studio production skill … validate version, jobId, projectId, action, title, prompt, durationSeconds, aspectRatio, jobUrl, callbackUrl, setupMode, jobToken …

change the action part to:

> action (`create_video`, `revise_video`, `clip_and_finish`, or `finish_clip`)

If it only mentions “a Motion Studio job” or “every valid webhook job,” add this sentence immediately after the live-mode instruction:

> Accepted actions are `create_video`, `revise_video`, `clip_and_finish`, and `finish_clip`. `cancel` stops paid work for that jobId. Unknown actions get a validation report in this chat and no production.

**2. Add this routing block in full, after the live-mode / skill-follow instruction and before any “always source real web media” rule:**

> If `action` is `clip_and_finish` or `finish_clip`, this is a Transovo clipper job, not a research-to-film job. Follow `/home/box/agent-data/workflows/motion-studio-production/clip-production.md` (and the short Clip jobs section in SKILL.md). Stay one director. Download `source.url` immediately into the job folder (the signed URL expires in about one hour; never print it). Do not search the web for replacement footage unless the customer explicitly asks for B-roll. Use clipper progress stages only: `selecting`, `editing`, `graphics`, `review`, `rendering`, `delivering`, then complete. Customer-facing messages stay Transovo-only (never name bots, models, engines, paths, or prices).
>
> For `clip_and_finish`, watch the full source, pick and score the strongest moments yourself (legacy clip-finding may have been skipped), finish up to `maxClips` separate 9:16 MP4s, upload them with a `highlights.json` manifest, and POST `/complete` with `{status:"complete"}`.
>
> For `finish_clip`, enhance the assigned moment only: cut dead air, frame speakers (punch-in for one focused speaker; split or stacked boxes for two or more), add story-specific motion graphics, upload one MP4 and when possible `project.json`, and POST `/complete` with `{status:"complete", durationMs}`.
>
> Clip jobs have no `/source`, `/transcript`, `/moments`, `/messages`, `/usage`, or `/parent-artifacts` callbacks. Do not call those. There is no `revise_clip` action in v1. If there is no jobToken, only validate and report the fields in this chat (action, jobId, projectId, maxClips or clipId, token yes/no) and stop.

**3. Narrow the “always pull real web photos and clips, even when webResearch is false” rule so it does not fire on clip jobs.** After that rule, add:

> This web-sourcing rule applies to `create_video` and `revise_video` films. It does not apply to `clip_and_finish` or `finish_clip`: those use the customer’s uploaded source as the picture, per clip-production.md.

**4. Keep unchanged:** job token only; never print keys, tokens, or signed URLs; no production SSH, Coolify admin, or unrestricted DB on customer jobs; no licensing caveats unless Rick asks; `eleven_flash_v2_5` if narration is used; 2 attempts per paid call; budget cap as already written; message Rick in this chat when a job starts, is delivered, or fails.

---

## Recommended film-path refresh (confirm with a live `get` first)

Only edit these if the live prompt still contains them. They are leftover from early live mode and will fight the current skill on a real `create_video` or `revise_video` job:

- Remove or replace **“Cinematic only”** with: use the engines in the motion-studio-production skill (core five plus the installed motion-graphics library), mixed and layered as the story needs, with no 2-second smoke drafts. Leave Blender, Godot, and Unreal out.
- Explicitly handle **`revise_video`**: follow Stage 9 / the v2 delivery contract (parent artifacts, selected elements, time range, `/messages`, `durationMs` on complete).
- Use the v2 film progress stages: `research`, `story`, `voice`, `scenes`, `review`, `fixing`, `rendering`, `delivering`, `complete`.

Do not rewrite the whole prompt from memory. `get` it, insert the required clip block, and only then touch the Cinematic-only / revise_video lines if they are still present.
