# Voice V3 — After-hours post-call pass (repository audit)

**Branch:** `cursor/voice-v3-after-hours-post-call-2304`  
**Scope:** One coherent pass — recording → transcript → summary → email → inbox/detail → knowledge gaps → analytics → webhooks.

## Authoritative object

`VoiceCall` (+ existing children) is the center. No parallel call database.

## Existing assets to reuse (do not duplicate)

| Area | Location | Notes |
|------|----------|--------|
| Call model | `prisma/schema.prisma` — `VoiceCall`, `VoiceRecording`, `VoiceTranscript`, `VoiceTranscriptSegment`, `VoiceConversationInsight` | Recording/transcript/insight tables exist |
| Post-call job | `voice_post_call` → `processPostCall()` in `src/lib/voice/post-call.ts` | Usage, insights, automations, MCTB hooks |
| LiveKit finalize | `finalizeLiveKitCall()` in `src/lib/voice/domain-actions/session-bootstrap.ts` | Sets COMPLETED, enqueues `voice_post_call` |
| LiveKit transcript chunks | `livekit-call-telemetry.ts` | Realtime segment append (not Deepgram post-call) |
| Recording ingest job | `voice_recording_ingest` in `job-handlers.ts` | Telnyx-oriented; creates `VoiceRecording` + stub transcription enqueue |
| Transcription stub | `src/lib/voice-receptionist-wizard/post-call/transcription-pipeline.ts` | V2 stubs — **replace with V3 Deepgram path** |
| Secure playback | `src/lib/voice/recordings.ts` + `/api/voice/recordings/[id]/stream` | Signed token gate |
| Player UI | `src/components/calls/waveform-recording-player.tsx` | Reuse on Call Detail |
| Calls UI | `/voice/calls`, `/voice/calls/[id]` | Kimi-family pages — extend, do not replace |
| Analytics API | `src/lib/voice/analytics.ts`, `/api/voice/analytics` | Real `VoiceCall` aggregation — extend for V3 dimensions |
| Brevo email | `src/lib/email/brevo.ts` | Transactional send + messageId |
| V3 notifications | `src/lib/voice-v3/notifications/dispatch.ts` | Idempotent metadata claims; extend for summary email |
| Outbound webhooks | `Webhook` model + `loadOutboundWebhooks` + integrations UI | Extend events/signing |
| Knowledge (runtime) | `VoiceV3KnowledgeConfig`, wizard `linkedKnowledgeBaseId` | Approved knowledge only — gaps are review queue |
| Jobs | BullMQ `enqueueJob` pattern, idempotency keys | Same queues (`voice-calls`) |
| Internal voice API | `/api/internal/voice-runtime` | Python worker callbacks |

## Recording media path decision

**Proven Voice V3 path:** Telnyx PSTN → LiveKit SIP inbound → LiveKit room → GPT-Live (Amy).  
**Not in scope:** Telnyx Call Control, second legs, or bridges for recording.

**Telnyx recording (Option A):** On this architecture, Telnyx only sees the SIP leg to LiveKit; Amy’s audio is mixed in the LiveKit room, not on the Telnyx leg. Native Telnyx call recording on the existing SIP trunk **does not** reliably capture caller + Amy without architectural change.

**Selected (Option B):** **LiveKit Egress** — audio-only room composite (or participant egress) using installed `livekit-server-sdk` `EgressClient`. Dual-channel / mixing per deployed API (`audioMixing` / multichannel file).  
Egress completion via LiveKit webhook (`egress_ended`) → `voice_recording_ingest` with `provider: livekit`.

See `docs/VOICE-V3-RECORDING-MEDIA-PATH-DECISION.md`.

## Target pipeline (single processor)

`processVoiceV3CompletedCall(callId)` in `src/lib/voice-v3/post-call/` — idempotent stages:

1. Load authoritative call + system facts (booking, callback, transfer, screening, billing)
2. `ensureRecordingFinalized` (wait/retry or re-enqueue if egress pending)
3. `ensureTranscript` (Deepgram prerecorded on recording URL)
4. `ensureCallSummary` (structured OpenAI + system facts win)
5. `persistPostCallArtifacts` (insight, metadata analytics dimensions)
6. `detectKnowledgeGaps` (candidates from summary pass → dedupe)
7. `sendPostCallEmail` (Brevo, skip spam/solicitor default)
8. `emitVoiceWebhooks` (existing `Webhook` destinations)

`processPostCall` delegates to this when `isVoiceV3LiveKitCall(call)`.

## Gaps this pass implements (incremental)

- [x] Audit + decision doc
- [ ] LiveKit egress start + webhook ingest
- [ ] Deepgram post-call transcription
- [ ] V3 summary + system facts
- [ ] Knowledge gap model + UI tab
- [ ] Calls inbox/detail upgrades (processing states)
- [ ] Analytics V3 outcome dimensions
- [ ] Webhook signing + voice event delivery
- [ ] Wizard: recording consent + after-call email settings
- [ ] Certification (browser, PSTN, Brevo, recording listen)

## Explicit non-goals (this pass)

Zoho, Teams, Bookings, Calendly, Zapier/Make/n8n apps, realtime Deepgram in Amy, duplicate analytics page, Telnyx Call Control for recording.
