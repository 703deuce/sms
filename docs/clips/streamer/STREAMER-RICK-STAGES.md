# Streamer — Rick stages (after regular clipper gaps)

**Status:** Stage 1 is the only active build until **manual sign-off** on real **2–6 h** Twitch/Kick VODs. **Do not start Stage 2** until that gate passes.  
**Regular clipper:** REGULAR-CLIPPER-GAPS pass complete on `master` (Oct 2026).  
**Billing:** not in scope — record **VOD minutes processed per workspace** only (`StreamUsage.sourceSeconds`).  
**Logging:** use **`[clipper:stream]`** at every step (import, chunk, transcribe, analyze, render, cleanup, autopull, retry). No secrets in logs.  
**Reliability:** idempotent jobs, resumable checkpoints in `StreamVod.state`, safe retries; **two-strike rule** for production fixes.

Long-form reference: `new-app/docs/clips/STREAMER_BUILD_SPEC.md` (milestones S0–S15). This doc is the **product gate** Rick asked for, mapped onto that spec.

---

## Stage 1 — Paste Twitch/Kick VOD into regular clipper

### User story

Paste a finished VOD / highlight / clip URL on the Streamer path (same product as upload clipper, streamer settings + ranking). User sees **clear progress and errors**. Long VODs use **chunked, resumable download** (worker restart ≠ failed user attempt). **~10 h cap** on analysed duration. When clipping **finishes successfully**, **delete full VOD source** from storage (keep clip outputs + per-clip segments).

### Maps to existing code

| Requirement | Where today | Gap / hardening |
|-------------|-------------|-----------------|
| Paste link + attestation | `lib/server/streamer/imports.ts`, `components/streamer/streamer-import-panel.tsx`, `POST /api/streamer/imports` | Wire Streamer tab on `/app/clips/new` if not already default path for paste |
| `STREAM_IMPORT` → analyze → render | `worker/clips_worker/streamer/import_job.py`, `analyze_job.py`, `render_job.py` | Standardize **`[clipper:stream]`** (today mixed / absent) |
| Resumable yt-dlp | `worker/clips_worker/streamer/import_cache.py` (`--continue`, scratch dir per `vodId`) | Document retry semantics; ensure reaper + heartbeat don’t count resume as new attempt in UI |
| Chunked long path | `STREAMER_CHUNK_MIN`, audio-first, chunk keys in `state.chunks` | Progress UI: chunk index + % for 2–6 h runs |
| ~10 h cap | `STREAMER_MAX_VOD_HOURS` (worker default **12**), `lib/server/streamer/limits.ts` (**12**) | Align product copy + env to **10** if Rick confirms (config-only change) |
| Delete source after clips ready | `STREAM_CLEANUP` (`cleanup_job.py`), enqueue after render success | **Gate:** delete on **project READY**, not only retention TTL; verify master audio + proxy keys gone |
| Progress / error states | `JobStatus`, `streamer/stage-stepper.tsx`, `StreamVod.error`, `terminal_failure_progress_payload` | User-visible messages for cap, yt-dlp fail, partial chunk fail |
| Usage minutes (no billing) | `lib/server/streamer/usage.ts`, worker `streamer/usage.py` `check_cap` / record | Ensure every completed import records **source seconds** once (idempotent) |
| Idempotent import | `_maybe_complete_import_from_state` in `import_job.py` | Extend checkpoints for chunk loop + analyze enqueue |

### Stage 1 acceptance (must pass before Stage 2)

1. **Manual prod/staging** (owner phone/laptop): **three** paste imports, **2–6 h** each, Twitch and Kick mix, no sub-only VODs.
2. Each run: refresh mid-import or kill worker once → job **resumes** without user “retry” counting as a new VOD attempt (same `projectId` / `vodId`).
3. After **READY**: storage has **no** full VOD master; clips play; `StreamVod.sourceDeletedAt` set.
4. `StreamUsage` increases by analysed seconds; no Stripe/plan UI.
5. Logs: every stage line searchable as `[clipper:stream]` with `vodId`, `projectId`, `jobId`, `stage` (no URLs with tokens).

### Stage 1 implementation order (suggested)

1. **`[clipper:stream]`** pass — worker streamer jobs + `imports.ts` / status API (small commits).
2. **Cap 10 h** — `STREAMER_MAX_VOD_HOURS` + `STREAMER_MAX_VOD_HOURS` in limits.ts + UI copy (config).
3. **Cleanup on READY** — verify/enqueue `STREAM_CLEANUP` immediately after successful `STREAM_RENDER` (not 24 h retention only).
4. **Progress UX** — expose chunk + download stage from worker `post_progress` payload on project page.
5. **Hardening tests** — pytest: `import_cache` resume, `_maybe_complete_import_from_state`, cleanup key list (mocked S3).

---

## Stage 2 — Eklipse-style auto-pull (after Stage 1 sign-off)

### User story

Connect **own** Twitch/Kick channel (OAuth). When a stream **ends**, automatically fetch the saved VOD and run the same pipeline as Stage 1. **Manual pull** for VODs in the **last 14 days** if auto missed. **Email or in-app** notice when clips are ready.

### Maps to existing code

| Requirement | Where today | Gap |
|-------------|-------------|-----|
| Twitch OAuth + EventSub offline | S13 in spec; `twitch-webhook.ts`, `webhooks/twitch` | Harden idempotent enqueue |
| Kick OAuth + webhook | S14; `kick.ts`, `webhooks/kick` | VOD discovery via yt-dlp `kick:videos` |
| Auto enqueue | `enqueueStreamAutopull`, `STREAM_AUTOPULL`, `autopull_job.py` | Reliability + `[clipper:stream]` |
| Manual pull 14d | Partial: channel pages, `vod-list.ts` | Explicit “Pull VOD” for last 14 days UI + API |
| Notify clips ready | `lib/server/streamer/notify.ts`, Brevo | Ensure fires once per VOD (`notifiedAt`) |
| Channel settings | `/app/streamer`, `channel-auto-process.tsx` | Auto-process toggle only when CONNECTED |

**Do not ship Stage 2** until Stage 1 manual matrix is signed off.

---

## Retention — clip expiry (config, both stages)

| Tier | Clip retention | Mechanism |
|------|----------------|-----------|
| Monthly (default) | **14 days** | Scheduled job deletes clip **storage** + soft-delete rows |
| Annual | **90 days** | Same job, tier from workspace config |

**Not built yet:** cleanup job behind env e.g. `STREAMER_CLIP_RETENTION_DAYS_MONTHLY=14`, `STREAMER_CLIP_RETENTION_DAYS_ANNUAL=90`, workspace flag for tier (no billing). Spec detail: STREAMER_BUILD_SPEC §S3 + new maintenance task in `app/api/internal/streamer/maintenance`.

**Distinct from source deletion:** Stage 1 deletes **raw VOD** after processing; retention deletes **finished clips** after N days.

---

## Worker deploy

Any Stage 1 change touching `worker/clips_worker/streamer/**` or job dispatch → commit message **`WORKER DEPLOY`**. Agent A deploys before prod VOD proofs.

---

## Rick decision log

| Date | Decision |
|------|----------|
| 2026-10-27 | Regular clipper gaps complete; Streamer **Stage 1** is next; Stage 2 blocked on 2–6 h VOD proof |
| — | Confirm **10 h** vs current **12 h** code default |
