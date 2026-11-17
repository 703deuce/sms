# Producer routine update — accept video type, creative, and brand kit fields

Do **not** apply this from here. The Motion Studio Producer bot (`90ec9cce-fbb8-4a0f-afc9-8e9a6ddcd0f2`) owns the webhook routine **Transovo Motion Studio Production** (panel id `motion-studio-job-intake`). This subagent cannot edit routines. Have that bot, or Rick’s main assistant with UpdateRoutine, `get` the live prompt and patch it.

The clip-job routing (`clip_and_finish`, `finish_clip`) and the later film-path refresh should already be in the live prompt. Do not remove them. `get` the prompt first, then insert the block below. Do not rewrite the whole prompt from memory.

This branch is **not** merged to master and is **not** deployed. The new fields will only arrive after ChatGPT’s frontend branch is validated and released. The producer should still accept them now so a first job on that branch does not drop the brief.

---

## Required patch (film jobs: `create_video` / `revise_video`)

**1. In the sentence that lists accepted webhook fields, add the creative fields.**

If the prompt already lists something like:

> validate version, jobId, projectId, action, title, prompt, durationSeconds, aspectRatio, jobUrl, callbackUrl, setupMode, jobToken

extend it to also accept, when present:

> `videoType`, `categoryGuidance`, `creative` (including `style`, `customStyle`, `instructions`, `brandMode`, `brandKitId`, `brand`, `referenceUploadIds`), `resolution`, `width`, `height`, `fps`, top-level `style`, `quality`, `webResearch`, and `mediaPolicy`

Unknown extra fields are ignored. Missing creative fields are not an error; older jobs will not have them. Never overwrite `prompt`.

**2. Add this block in full, after the live-mode / skill-follow instruction and after the existing clip-job routing block, so it applies to `create_video` and `revise_video` only:**

> When a film job includes `videoType`, `categoryGuidance`, or `creative`, follow `/home/box/agent-data/workflows/motion-studio-production/brand-and-type.md` (and the Stage 0 / Creative Director notes in SKILL.md) in addition to the rest of the production skill.
>
> `videoType` and `categoryGuidance` shape the production requirements. They are never a fixed scene template. Every project still gets original art direction, compositions, animation, and storytelling.
>
> `creative.style` is optional direction inside Visual DNA (`automatic` means invent freely; `custom` uses `creative.customStyle` or the top-level `style` string). All three concepts must still fit in that lane, and the look must still clear the style ledger.
>
> Brand consistency: `strict` means use the approved brand colors, typography (`fontPreference`), and logo usage exactly; `guided` means the brand leads but the director still has freedom; `creative` means the brand is loose inspiration unless the user states a mandatory requirement. If `creative.brandMode` is `none`, ignore brand fields.
>
> Honor `logoPlacement` (`intro`, `outro`, `watermark`, `ai_decides`, `none`). Analyze `referenceUploadIds` (and the matching `GET jobUrl` `inputs[]` entries, which now include `uploadId`, `filename`, `mime`, and `url`) for visual direction; do not copy their compositions. Download those inputs immediately; signed URLs expire in 30 minutes; never print them.
>
> `creative.instructions` sit on top of the original `prompt`. Do not replace or shorten the prompt.
>
> Honor the requested `durationSeconds`, `aspectRatio`, and `resolution` (`width` × `height` at `fps`). Do not promise native GIF, alpha, or 5-second exports; the current deliverable is MP4 and the UI minimum is 30 seconds.

**3. Setup-mode validation report:** when there is no `jobToken` or `setupMode` is true, also report (field present/missing and a short value, never URLs or tokens): `videoType`, `creative.style`, `brandMode`, `consistency`, `logoPlacement`, `referenceUploadIds` count, `durationSeconds`, `aspectRatio`, and `resolution`. Then stop, as today.

**4. Keep unchanged:** accepted actions (`create_video`, `revise_video`, `clip_and_finish`, `finish_clip`); clip jobs still follow `clip-production.md` and do not run the film stages; always pull real photos and clips of the actual subject on film jobs; no licensing, rights, or font caveats unless Rick asks on that job; ElevenLabs narration uses `eleven_flash_v2_5`; no draft or smoke renders; variety / style ledger; Rick’s framing rule; Transovo-only customer progress copy; never print keys, tokens, or signed URLs; no production SSH, Coolify admin, or unrestricted DB on customer jobs; 2 attempts per paid call; budget cap as already written; message Rick in this chat when a job starts, is delivered, or fails.

---

## Optional one-liner if a clip job later carries `creative`

Only add this if the live prompt has a natural place after the clip routing block:

> If a `clip_and_finish` or `finish_clip` payload includes `creative` or brand fields, apply `brand-and-type.md` to graphics, captions, and framing only. Do not leave the clip playbook or treat those fields as a film template.
