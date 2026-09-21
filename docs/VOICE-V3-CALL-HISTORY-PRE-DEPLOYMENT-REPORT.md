# Voice V3 Call History — Pre-Deployment Report

**Starting SHA (branch base):** `a26ccff5` (on `cursor/voice-v3-call-history-2304`, production baseline reference `4f5e99e4c566190e98f43c39fab781d0417c4311`)

**Final candidate SHA:** `33531dee`

**Production deployment:** NOT performed (per instruction).

---

## 1–4. Audit summary — reused vs restored

| Area | Decision |
|------|----------|
| Calls list `/voice/calls` | **Reused** — existing Kimi table, filters, API |
| Call detail `/voice/calls/[id]` | **Reused** — extended processing states; fixed `deriveOutcomeBadges` |
| Prisma `VoiceCall`, `VoiceRecording`, `VoiceTranscript`, segments | **Reused** — no migration required this pass |
| Native transcript from GPT-Live | **Reused** — `forensics-persist.ts` → `VoiceTranscript` (`voice_v3_livekit`) |
| Telnyx `call.recording.saved` webhook | **Reused** — `webhook-handlers.ts` → `voice_recording_ingest` job |
| Recording signed playback | **Reused** — `recordings.ts` + stream route (extended for Supabase) |
| Deepgram prerecorded | **Reused** — `lib/transcription/deepgram-prerecorded.ts` |
| Object storage | **Reused** — `smart-routing/call-recording-storage.ts` (Supabase private bucket) |
| Post-call job | **Reused** — `voice_post_call` + new `voice_v3_call_history` idempotent job |
| V2 transcription pipeline stub | **Restored/implemented** — `transcription-pipeline.ts` (was no-op) |

**New modules:** `src/lib/voice-v3/call-history/*`, `src/lib/voice/call-recording-ingest.ts`

---

## 5–8. Recording

**Provider:** Telnyx Call Control `record_start` (dual-channel MP3), fail-open at Voice V3 PSTN forward.

**Why:** PSTN leg stays on Telnyx; captures caller + mixed AI audio without LiveKit Egress or worker PCM.

**Lifecycle:**

1. `maybeStartVoiceV3TelnyxRecording` on SIP forward (honors `telephony.callRecording`)
2. `VoiceRecording` row `recording` → Telnyx records call
3. `call.recording.saved` → `voice_recording_ingest`
4. Download provider URL → upload Supabase → `storageUrl` = `supabase:bucket:path`, status `ready`
5. Enqueue Deepgram only if native transcript invalid (see below)

**Storage:** Supabase bucket `SUPABASE_CALL_RECORDINGS_BUCKET` or `call-recordings`; DB holds opaque `storageUrl`; playback via signed token stream route.

**DB fields:** Existing `voice_recordings` (`provider`, `providerRecordingId`, `storageUrl`, `status`, `format`, `channels`, `durationSeconds`).

---

## 9–15. Transcript

**Native source:** LiveKit/GPT-Live canonical turns persisted in `persistVoiceV3ForensicsPackage` → `VoiceTranscript` + segments (user/assistant only; system turns excluded).

**Completeness validator:** `native-transcript-validator.ts` — caller + agent turns, ordering, duration density, no tool/diagnostic leak, forensics `final` when provider is native.

**Production call `oATFW5UYHFah`:** Not mutated; expect native transcript from forensics flush if 18 caller turns were committed (validate in staging DB read-only).

**Deepgram fallback:** `deepgram-fallback.ts` + `voice_v2_post_call_transcription` job; multichannel when `channels > 1`; skipped when native validates.

**Speaker mapping:** Dual-channel — channel 0 → caller, 1 → agent; diarize only for single-channel.

**Transcript storage:** `voice_transcripts` + `voice_transcript_segments`; call-level state mirrored in `VoiceCall.metadata.callHistory`.

---

## 16–22. Summary & UI

**Summary:** `ensureCallHistorySummary` — deterministic facts from `VoiceCall` / appointments / transfers; optional OpenAI `VOICE_CALL_SUMMARY_MODEL` or `gpt-4.1-mini` when transcript length > 80; stored in `voice_conversation_insights`.

**Calls list:** Existing page + API (`/api/voice/calls`) — outcome badges, recording id, summary snippet.

**Call detail:** Recording player when `recordings[0]`; processing/unavailable copy from `metadata.callHistory`; transcript tab from segments; AI summary from insights.

**Audio player:** `WaveformRecordingPlayer` → signed `/api/voice/recordings/:id/stream?token=…`

**Processing states:** `callHistory.recordingStatus`, `transcriptStatus`, `transcriptProvider` on `VoiceCall.metadata`.

---

## 23–26. Security, APIs, jobs

**Auth:** Session on call APIs; recording stream requires HMAC token bound to `recordingId` + `workspaceId`; `requireVoicePermission` on URL mint.

**New/updated job types:**

- `voice_recording_ingest` — durable ingest (idempotent by `providerRecordingId`)
- `voice_v3_call_history` — validate native → optional Deepgram → summary
- `voice_v2_post_call_transcription` — Deepgram worker (skips if native valid)

**API routes touched:** `GET /api/voice/recordings/[id]/stream` (Supabase signed redirect)

---

## 27. Migrations

None required (additive metadata JSON only).

---

## 28. Environment variables

| Variable | Status |
|----------|--------|
| `TELNYX_API_KEY` | Check deploy env (not printed) |
| `DEEPGRAM_API_KEY` | Required for fallback only |
| `OPENAI_API_KEY` | Required for LLM summary upgrade |
| `INTEGRATION_SECRET_KEY` | Recording playback tokens |
| `SUPABASE_CALL_RECORDINGS_BUCKET` | Optional (defaults `call-recordings`) |
| `APP_URL` | Playback stream base |

---

## 29–35. Tests & performance

**Automated:** `scripts/test-voice-v3-call-history.ts` — **PASS** (validator, auth tokens, summary, badges).

**Regression:** `scripts/test-voice-v3-active-agent-demo-fallback.ts` — **PASS**.

**Browser/UI:** Not fully automated in cloud VM (no authenticated dev session in this pass). Manual checklist: open `/voice/calls`, detail, play, transcript, refresh.

**Performance:** Post-call work is async; no live-path blocking. Target metrics to observe in staging: hangup → `callHistory` updated, recording ingest latency, Deepgram only on reject.

---

## 36–40. Architecture confirmations

- Microsoft booking / Voice V3 live path **unchanged** (no GPT-Live/Sol/session edits).
- GPT-Live / Responses / Sol architecture **unchanged**.
- No realtime Deepgram/STT added to conversation path.
- **No production deployment** performed.

---

## 41. External blockers

- **Telnyx recording** must be enabled on workspace connection and `callRecording` wizard setting not `off`.
- **Supabase storage** credentials required for durable copy (otherwise ingest keeps provider URL with `processing` risk).
- **Deepgram** only needed when native transcript fails validation.

---

## 42. Files changed

```
src/lib/voice-v3/call-history/deepgram-fallback.ts
src/lib/voice-v3/call-history/native-transcript-validator.ts
src/lib/voice-v3/call-history/post-call-pipeline.ts
src/lib/voice-v3/call-history/start-telnyx-recording.ts
src/lib/voice-v3/call-history/summary.ts
src/lib/voice/call-recording-ingest.ts
src/lib/voice-v3/start-appointment-receptionist-pstn.ts
src/lib/voice-v3/telemetry/forensics-persist.ts
src/lib/voice-receptionist-wizard/post-call/transcription-pipeline.ts
src/lib/voice/post-call.ts
src/lib/voice/python-runtime-bridge/voice-v3-forensics-bridge.ts
src/lib/voice/calls/display.ts
src/lib/jobs/job-handlers.ts
src/app/api/voice/recordings/[id]/stream/route.ts
src/app/(app)/voice/calls/[id]/page.tsx
scripts/test-voice-v3-call-history.ts
docs/VOICE-V3-CALL-HISTORY-PRE-DEPLOYMENT-REPORT.md
```
