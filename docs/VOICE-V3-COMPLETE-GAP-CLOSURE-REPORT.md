# Voice V3 — complete gap-closure report (code pass)

**Branch:** `cursor/voice-v3-final-completion-2304` (final four-area pass)  
**Date:** 2026-09-21 (final manifest + runtime pass)  
**Authority:** `docs/VOICE-V3-COMPLETE-GAP-CLOSURE-IMPLEMENTATION-DIRECTIVE.md`, `docs/AI-VOICE-AGENT-INCOMPLETE-MASTER-LIST.md`

## Manifest truth (final)

`buildWizardV3FieldManifest()`:

| executionStatus | count |
|-----------------|------:|
| ACTIVE_EXECUTION | 187 |
| LIVE_PROMPT_CONTROL | 5 |
| CONTROL_PLANE_ONLY | 19 |
| INTENTIONALLY_UNSUPPORTED | 5 (4× Calendly wizard fields, 1× `crmEnabled`) |
| CONFIGURED_NOT_IMPLEMENTED | **0** |

Regenerate NI list: `docs/AI-VOICE-AGENT-INCOMPLETE-MASTER-LIST.md` § regenerate §1.

## Shared systems delivered

| System | Location | Master-list coverage |
|--------|----------|----------------------|
| Service policy (notice, horizon, permission, calendar id) | `src/lib/voice-v3/policy/service-policy.ts` | §1 appointment type fields, §4 #141 |
| Per-service book intake keys | `intake-objective/operation-requirements.ts` + `service-policy` | `appointmentTypes[].requiredFields[]` |
| Qualification engine | `src/lib/voice-v3/qualification/evaluate-qualification.ts` | §1 #57–70, §2 #119 |
| Urgency engine | `src/lib/voice-v3/urgency/evaluate-urgency.ts` | §1 #71–79, §2 #116 |
| Operating + after-hours gating | `effective-tool-authorization.ts`, on-call in `authorize-transfer.ts` | §1 on-call/SLA/holidays, §4 #133–136 |
| Holiday slot suppression | `slot-generator.ts`, `find-dispatch.ts` | §4 #134 |
| REQUEST_ONLY execution | `submit_appointment_request` tool + persist | §2 #113, §4 REQUEST_ONLY |
| RAG retrieval compile | `compile-voice-v3-agent-config.ts`, `resolve-document-source-ids.ts`, `from-published-agent.ts` | §1 knowledge rows |
| `take_message` tool | `tools/take-message-tool.ts` | §1 `take_messages` capability |
| Outbound SMS (canonical resolver) | `sms/resolve-voice-v3-outbound-sms.ts` | §1 #1–3, §4 #140 |
| Booking confirmation SMS | `sms/send-booking-confirmation-sms.ts`, `book-dispatch.ts` | §2 #108 |
| Callback SLA metadata | `callback/persist-voice-v3-callback-request.ts` | §1 SLA rows |
| AI call recovery SMS (post-call) | `post-call/ai-call-recovery-sms.ts` | §1 #98–103 |
| Publish quality gate | `config/validate-publish-quality.ts`, `save-setup.ts` | §2 #123 |
| V2 publish KB preservation | `voice/receptionist/recompile.ts` | publish artifact separation (partial) |
| V1 wizard Calendly hide | `appointments-step.tsx` (`V1_VOICE_BOOKING_PROVIDERS`) | FUTURE_CALENDLY |
| Manifest reconciliation | `wizard-v3-manifest-builder.ts` | §A + §2 #147 |

## Disposition summary (numbered items)

- **IMPLEMENTED:** All rows above; manifest `CONFIGURED_NOT_IMPLEMENTED` = 0.
- **INTENTIONALLY_UNSUPPORTED (V1):** Calendly V3 executor fields (compiled for legacy state only); `crmEnabled`.
- **MANUAL PRODUCTION CERTIFICATION:** §5 PSTN gates, full §6 Google prod OAuth/PSTN, §7 certification matrix, transfer PSTN waterfall handset tests.
- **MANUAL (billing):** Stripe meter event API wiring on tenant — ledger + idempotent dispatch in code; production meter ID in Stripe config.

## Automated tests (final pass)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-wizard-manifest-coverage.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-wizard-compiler.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-qualification-urgency.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-service-policy.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-booking-behavior-policy.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-operating-policy-gating.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-callback-matrix.ts
```

## Final completion pass (four areas)

See `docs/VOICE-V3-FINAL-READINESS.md` and `docs/VOICE-V3-FINAL-PRODUCT-COMPLETION-DIRECTIVE.md`.

| Item | Status |
|------|--------|
| Website crawler | DONE (async job + capped multi-page) |
| Business auto-import | DONE (suggestions on crawl job) |
| OpenAI vector-store ingest | DONE (existing pipeline) |
| Per-call billing | DONE (`VoiceV3UsageEvent` + dispatch job) |
| Call forensics | DONE (tool + `VoiceCallEvent` telemetry) |
| Hard-action guards | DONE (`authorizeVoiceV3BookingMutation`) |
| Objective-pivot safety | DONE (existing + regression scripts) |
| Wizard manifest NI | 0 |

**End of report.**
