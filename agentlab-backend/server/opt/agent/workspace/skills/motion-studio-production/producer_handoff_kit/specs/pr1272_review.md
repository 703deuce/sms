# Review of PR #1272 (Motion Studio creator experience)

Repo `703deuce/sms`, draft PR https://github.com/703deuce/sms/pull/1272
Branch `feat/motion-creator-experience-20261120` (head `618375d1`),
based on `feat/self-hosted-motion-render-20261120` (`2e13cc63`).
Reviewed Nov 20, 2026 against `/workspace/handoff_for_chatgpt/creator_experience_phase1_spec.md`.
22 files, +1203 / −25. Nothing was commented, pushed, merged, deployed, or edited in the repo.

## Short verdict

**Ready for a live test.** The PR matches the spec on the core path: Start still goes straight to production with no approval gate, Quick Create is today's form plus a mode label, Customize adds the optional inputs, a typed brief is saved and sent on both the producer webhook and `GET {jobUrl}`, paid ElevenLabs music is the default, voice APIs call instant clone and delete on the server with the existing API-key helper, Prisma changes are additive, no rights or licensing copy was added, and no render or QA files were touched.

There are no defects that should block a live UI and integration test. Fix the items in "Should fix before merge" before this is merged into the auto-deploying live branch. Do **not** merge or deploy until Rick approves.

---

## What matches the spec (no change needed)

- **Start is unchanged as a dispatch.** `motion-studio-create.tsx` still calls `createProject` and, in live mode, immediately `POST /api/motion-studio/agent/jobs` with only `{ projectId }`. The Start button still uses `MS_LABELS.start`. There is no "Review plan", no approve step, and no stop of auto-start.
- **Quick Create** is the default tab and keeps the existing prompt, length, type, style, canvas, resolution, brand kit, notes, attachments, and idea/script/footage tiles. Customize only reveals extra sections. Switching tabs does not clear Customize values, and Start still sends them in the brief (covered by a UI test).
- **Typed brief** (`new-app/lib/motion-studio/production-brief.ts`) is sanitized and stored on `settings.productionBrief` in `createProject`. Roles are mime-checked on the server. Filename heuristics are used only when no explicit role was given. `dispatchAgentJob` puts `brief`, `workflow`, and `brief.inputs` on the webhook; `botGetAssignment` returns the same `brief` plus signed `inputs[]` URLs with `handling`. Revisions reuse the same `dispatchAgentJob` payload, so the original brief travels with `revise_video`.
- **Hardcoded `webResearch: true` was removed** from the webhook. It now sends `settings.webResearch !== false`. New jobs still research by default because `DEFAULT_SETTINGS.webResearch` is now `true`.
- **Default music is paid ElevenLabs** (`music.mode = 'elevenlabs'`, `handling = 'paid_generate'`) in the sanitizer, `DEFAULT_SETTINGS`, Customize, and prompt-only tests. A customer can still choose an uploaded track or no music.
- **Voice APIs** under `/api/motion-studio/voices` use `requireMotionStudioCaller`, are independent of T2V and clips-worker, and never return the API key. Clone is `POST https://api.elevenlabs.io/v1/voices/add` with `xi-api-key` from `getElevenLabsApiKey()` (accepts `ELEVENLABS_API_KEY` or `ELEVENLABS_KEY`), 180s timeout, 502 and no row on failure. Delete is `DELETE /v1/voices/{id}` (404 treated as gone), then the local row is removed. List/rename/delete/default all filter cloned rows by `workspaceId` + `userId`. Stock catalog rows cannot be deleted on the customer route. A first cloned voice becomes the default when none exists. Quick Create with no picker selection attaches that saved default in `createProject`.
- **14 curated stock voices** are in `stock-voices.ts` and inserted by the migration. The list API returns at most 20 enabled rows by `sortOrder` and does not load the full ElevenLabs library.
- **In-browser cloning and narration recording** use `getUserMedia` + `MediaRecorder` (prefers `audio/webm;codecs=opus`), existing `client.uploadFile`, Record/Upload tabs, 10s UI minimum and 120s auto-stop for clones, and a clear "microphone blocked, use Upload" path. No rights, licensing, or copyright copy on the clone screen or the plan summary.
- **Your video plan** is a read-only summary on the project page only while an agent job is already running (`agentJob.status !== 'complete'`). Copy says production has already started. No approve or hold actions.
- **Prisma migration** `20261120170000_motion_studio_creator_voices` only creates two new tables, indexes, and an `INSERT ... ON CONFLICT DO NOTHING` seed. No drops, no alters of existing tables.
- **Producer skill** intake in `SKILL.md` covers exact/improve script, creator-opinion commentary, source links and preferences, fixed `voiceId`, uploaded voiceover, talking-head (not Path A), paid music default, and revision continuity. Pointers were also added to `film-pipeline.md` and `brand-and-type.md` (see typo below).
- **Render and QA files were not modified.** Diff is only the 22 files listed on the PR.

---

## Should fix before merge

These are not reasons to hold a live test, but they should be cleaned up before this lands on the auto-deploying branch.

### 1. Stock voice previews are empty in the seed

`new-app/lib/motion-studio/stock-voices.ts` has no `previewUrl` field. The migration inserts 14 rows with `previewUrl = ''`. At list time, `listVoices` falls back to `GET /v1/voices/{id}` and uses ElevenLabs' `preview_url` if it comes back. If the key is missing, a voice id is wrong, or the official preview is empty, the picker shows a disabled play button ("Preview is not available").

**Fix:** Put official HTTPS `preview_url`s in `MOTION_STOCK_VOICES` and in the migration seed, after confirming each of the 14 ids with the server key (`GET /v1/voices/{id}` or `/v2/voices`). If you need to backfill an already-applied migration, add a follow-up data migration or a start-up upsert that updates `previewUrl`, `name`, `description`, `gender`, `accent`, and `sortOrder` only, and **does not** set `enabled = true` (keep the current "do not re-enable disabled catalog rows" behavior). `ON CONFLICT DO NOTHING` will not fill empty preview URLs on a re-run.

### 2. Literal `\n\n` broke two producer-doc headings

In `producer_handoff_kit/skills/motion-studio-production/film-pipeline.md` and `brand-and-type.md`, the new lead-in paragraphs end with the four characters backslash-n, backslash-n, then the next heading on the same line:

- `...typed creator brief.\n\n## 1. Research and story`
- `...verified fact.\n\n## Fields`

Replace those literal `\n\n` sequences with a real blank line so `## 1. Research and story` and `## Fields` are actual headings again.

### 3. "Auto-select narrator" is ignored when a default voice exists

Customize has an Auto-select control that clears the picked voice and is meant to be `tts_auto_voice` (producer searches the library). `createProject` always does this when `narration.mode === 'ai_voice'` and no `voiceId` is present:

```ts
const preferred = await defaultVoice(workspaceId, userId)
if (preferred) {
  // writes voiceId, switches cloned defaults to cloned_voice,
  // sets handling to tts_with_voice_id
}
```

Quick Create silently using the saved default is correct. The bug is that Auto-select looks identical to "no voice was chosen," so a customer who has a default cannot opt back into producer-picked voice.

**Fix:** Distinguish the two cases in the brief, for example `narration.voiceSource: 'auto'` when the customer clicks Auto-select. In `createProject`, attach the saved default only when `voiceId` is missing **and** `voiceSource` is not `'auto'`. Keep today's Quick Create behavior (no `voiceSource` sent → attach default). Add a test for both cases.

### 4. Tighten voice-clone limits and the route timeout

In `new-app/lib/server/motion-studio/voices.ts` `createClone`:

- The 10-second minimum is skipped when `sample.durationMs` is null. Many uploads will not have duration set. If duration is missing, reject the sample or inspect the audio before calling ElevenLabs; do not let a 2-second clip through.
- There is no server-side 2-minute cap (the recorder stops at 120s, but Upload does not).
- Accept a few common aliases in the mime allow-list after stripping parameters: `audio/wave`, `audio/x-m4a`, `audio/aac`.
- Set the ElevenLabs form `description` to an internal workspace/user tag (never shown in the customer UI), as the spec asked, so clones in the shared ElevenLabs account can be attributed.
- On `new-app/app/api/motion-studio/voices/route.ts`, export `const maxDuration = 180` so the App Router (and any host that honors it) will wait for instant voice clone. Confirm the Coolify / proxy timeout for this path is also at least 180 seconds. A 60s proxy cut-off will make Create voice fail even though the fetch abort is 180s.

### 5. My Voices isolation is correct in code, but not real in today's no-login workspace

List, use, rename, default, and delete all key off `workspaceId` + `userId`. A guessed foreign `voiceId` cannot be used as a stock or cloned narrator. That is the right model.

`requireMotionStudioCaller` is still the pinned single test operator (see the comment in `new-app/lib/server/motion-studio/auth.ts`). In the current no-login Motion Studio workspace, every tester is the same user, so they will share one My Voices list. Do not treat that as a bug in this PR, and do not claim cross-customer isolation works until Motion Studio auth is no longer pinned. The code is ready for real auth; the environment is not.

---

## Non-blocking notes

- When `creative.style === 'automatic'`, the webhook `style` field is now `'automatic'` instead of the old setup `visualDirection` (usually `cinematic`). This is what the spec asked for (one style field; automatic means the producer invents the look). It is a small Quick Create dispatch change. The producer skill pointer in `brand-and-type.md` already describes it.
- `DEFAULT_SETTINGS.webResearch` flipped from `false` to `true`. For the live Start path this matches the old hardcoded webhook. The rarely used Setup step will now show web research On rather than Off.
- The plan summary does not include the existing `AllowancePanel` estimate or source preferences. Both were optional. No rights language was added.
- `productionBrief.brand` is always set to the creative snapshot, even when `brandMode` is `none`. The spec said to omit brand in that case. Harmless if the producer honors `brandMode`.
- `stock-voices.ts` descriptions are slightly longer than the migration seed text. After migrate, the API serves the DB rows.
- The migration adds a partial unique index `MotionStudioVoice_one_default_idx` that is not declared in `schema.prisma`. It is a good safeguard (with the advisory lock in `setDefaultVoice`). If anyone later uses `prisma db push`, that index could be dropped. Prefer adding a matching Prisma-level constraint or documenting that migrate-deploy is required.
- Clone samples are capped at 25 MB on this route. General footage still uses the existing clips upload pipeline (large S3/TUS cap, 10-hour duration cap). Fine.
- Uploaded-narration recording attaches the file on Stop with no playback or minimum length in that widget (the clone modal is stricter). Nice-to-have polish.
- Saved stock defaults appear under My Voices as `kind: 'stock_favorite'`. They cannot be deleted through the customer delete route, which is correct, but the row can look like a clone. A short "Studio voice (default)" label would be clearer.
- `createClone` does not send a description today (see item 4). If the DB insert fails after ElevenLabs create, the code already deletes the provider voice.
- Activity text on project create still says "Nothing renders until you create the plan." That is pre-existing and misleading now that Start dispatches the producer. Optional cleanup, not introduced by the new UI.
- Tests cover sanitizer cases and Quick Create / Customize persistence and brief payload. There are no tests for the voice routes, ElevenLabs 502-and-no-row behavior, per-user isolation, or `dispatchAgentJob` / `botGetAssignment` carrying the brief. Worth adding, but not a reason to hold the live test.
- Hidden Customize fields (for example a half-typed URL) can make Start fail while the customer is back on Quick Create, because those values are still sent. Show the error clearly; optionally jump back to Customize when a Customize field is invalid.

---

## Rights and licensing

No new rights, licensing, copyright, or source-rights warnings, gates, or checkboxes were added in the UI, job brief, plan summary, or the new skill text. The only "copyright" / "licensing" hits in the touched producer docs are pre-existing rules (do not write copyrighted lyric prompts; "No licensing work" already forbids rights checks). Nothing to remove.

---

## CI and TypeScript (as of 4:39 PM ET Nov 20)

- New workflow `.github/workflows/motion-creator-pr.yml` ("Motion creator experience checks"), run 19, [passed](https://github.com/703deuce/sms/actions/runs/44822001488) on head `618375d1`. It validates Prisma, runs `tests/motion-studio/motion-studio-create.test.tsx` and `production-brief.test.ts`, and fails only if `tsc` reports errors in the creator-specific paths. Whole-app TypeScript errors are counted and not gated, which matches the PR description. The exact whole-app error count is in that job log; I did not re-run `tsc` locally.
- I did not find a failing check on this head for the creator workflow.

---

## Pre-deploy steps (after Rick approves a merge)

Do not merge until he says so. This PR targets `feat/self-hosted-motion-render-20261120`, and that branch auto-deploys to Coolify app 1 (`ds8s3hjin60qs6g7s0iqkixs`). Merging is what makes it live. It does not go live from this draft branch by itself.

1. **Confirm `ELEVENLABS_API_KEY` or `ELEVENLABS_KEY` is already set on app 1.** This PR adds no new env var name. The same helper already used for paid music is used for clone, delete, and stock previews. If the key is missing, Start still works, but Create voice returns 502 and stock previews stay empty. No new secret is required if music already works on the live app.
2. **Database migration runs automatically on container start**, not during the image build: `new-app/scripts/start-production.mjs` → `run-db-migrations.mjs` → `prisma migrate deploy`. The new migration creates `MotionStudioVoice` and `MotionStudioStockVoice` and seeds the 14 catalog rows. There is no separate seed command to run by hand. Confirm `SKIP_DB_MIGRATE_AT_START` is not set to `1`, and that `DATABASE_URL` is present (if it is unset, start skips migrate, and then every Start can fail because `createProject` queries `MotionStudioVoice` for a default). A failed migrate already prevents the app from starting, which is the right fail-closed behavior.
3. **After deploy, confirm the 14 stock rows exist and are enabled**, and that preview playback works in the picker (item 1). If previews are blank, backfill official preview URLs.
4. **Confirm the proxy / platform timeout** for `POST /api/motion-studio/voices` is at least 180 seconds (item 4).
5. **Live-test before calling it done**, against the connected services:
   - Prompt-only Quick Create still dispatches immediately, defaults to paid music, and attaches a saved default voice if one exists.
   - A full Customize job (exact/improve script, commentary, links, footage roles, upload or talking-head, own music or none) writes the right `role` and `handling` on the project, the webhook, and `GET {jobUrl}`.
   - Record a clone in the browser, preview it, set default, rename, delete (ElevenLabs voice + local row gone), and confirm the chosen `voiceId` is on the brief.
   - Stock preview playback, and End-to-end producer dispatch, in the real Transovo UI (responsive pass as well).
   - Confirm the watchable MP4 still appears as soon as it is ready (this PR must not regress master-first delivery; it does not touch those files, but the live path should still be checked once).

Do not merge PR #1270 or #1271 as part of this work. Do not edit render-worker, QA, or delivery code in this follow-up.

---

## Round 2 (head 4981361e, Nov 20, 5:21 PM ET)

Re-reviewed the 9 commits after `618375d1`. Diff touches only the seven creator files listed below. No render or QA files, and no rights or licensing copy.

**Not ready to merge.** The creator CI job failed on the TypeScript gate.

### Failed CI

- Workflow: [Motion creator experience checks, run 44828136955](https://github.com/703deuce/sms/actions/runs/44828136955) on `4981361e`.
- Prisma validation and creator tests (including the new Auto-select sanitizer test) passed.
- TypeScript creator-specific gate failed at 5:21 PM ET:

```
lib/server/motion-studio/voices.ts(47,5): error TS1005: ',' expected.
```

Cause: `listVoices` was changed from an implicit-return arrow (`async row=>({ ... })`) to a block body (`async row=>{ ... return ... }`), but the old extra `)` was left in place. Line 47 is `})))` and should be `}))`. That syntax error also means the new preview-URL persist code does not compile, so it is not shippable until this is fixed and CI is green.

### Fixes that otherwise check out

1. **Auto-select over a saved default — verified.** The picker now sends `voiceSource: 'auto'`. `sanitizeProductionBrief` keeps it and sets `tts_auto_voice`. `createProject` only attaches a saved default when `mode === 'ai_voice'` and `voiceSource !== 'auto'`. Quick Create with no picker choice still attaches the default. Regression test: `retains explicit Auto-select even when no voice ID is attached` in `production-brief.test.ts`. (That test covers the sanitizer, not `createProject` itself. The server condition is correct; a service-level test would still be useful.)
2. **Clone limits — mostly verified.** Server now requires finite `durationMs` in the 10s–5min range and still caps samples at 25 MB. The ElevenLabs `fetch` abort is 240 seconds. **Gap:** `new-app/app/api/motion-studio/voices/route.ts` still does not export `maxDuration`. On this self-hosted Coolify app, `maxDuration` may be ignored anyway; the real cap is the reverse-proxy timeout, which is not set to 240s in this PR. Add `export const maxDuration = 240` for hosts that honor it, and confirm the Coolify/proxy timeout is at least 240s before relying on the longer provider wait.
3. **Literal `\\n\\n` in producer docs — verified.** `film-pipeline.md` and `brand-and-type.md` now have real blank lines before `## 1. Research and story` and `## Fields`. Zero remaining literal `\n` sequences.
4. **Persisting stock preview URLs — logic is right, but blocked by the syntax error above.** Successful HTTPS lookups would be written only when `previewUrl` is non-empty and the row is still `''`. Failed lookups return `''` and are not written. The DB update is `.catch(()=>{})`, so a write failure would not break the list response. After fixing the extra `)`, this should be fine. The first list still needs a live ElevenLabs lookup, as ChatGPT noted.

### Suggested fix

In `new-app/lib/server/motion-studio/voices.ts`, change the `stockVoices` mapper close from `})))` to `}))`. Re-run the creator CI. Optionally add `export const maxDuration = 240` on the voices route.
