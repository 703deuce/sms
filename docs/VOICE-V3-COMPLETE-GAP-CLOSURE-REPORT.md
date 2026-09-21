# Voice V3 — complete gap-closure report (code pass)

**Branch:** `cursor/voice-v3-gap-closure-2304`  
**Date:** 2026-09-21  
**Authority:** `docs/VOICE-V3-COMPLETE-GAP-CLOSURE-IMPLEMENTATION-DIRECTIVE.md`, `docs/AI-VOICE-AGENT-INCOMPLETE-MASTER-LIST.md`

## Shared systems delivered

| System | Location | Master-list coverage |
|--------|----------|----------------------|
| Service policy (notice, horizon, permission, calendar id) | `src/lib/voice-v3/policy/service-policy.ts` | §1 appointment type fields, §4 #141 |
| Qualification engine | `src/lib/voice-v3/qualification/evaluate-qualification.ts` | §1 #57–70, §2 #119 |
| Urgency engine | `src/lib/voice-v3/urgency/evaluate-urgency.ts` | §1 #71–79, §2 #116 |
| Operating + after-hours gating (extended) | `effective-tool-authorization.ts`, on-call in `authorize-transfer.ts` | §1 on-call/SLA/holidays partial, §4 #133–136 |
| Holiday slot suppression | `slot-generator.ts`, `find-dispatch.ts` | §4 #134 |
| REQUEST_ONLY execution | `submit_appointment_request` tool + persist | §2 #113, §4 REQUEST_ONLY |
| Outbound SMS (canonical resolver) | `sms/resolve-voice-v3-outbound-sms.ts` | §1 #1–3, §4 #140 |
| Booking confirmation SMS | `sms/send-booking-confirmation-sms.ts`, `book-dispatch.ts` | §2 #108 |
| Callback SLA metadata | `callback/persist-voice-v3-callback-request.ts` | §1 SLA rows |
| AI call recovery SMS (post-call) | `post-call/ai-call-recovery-sms.ts` | §1 #98–103 |
| Publish quality gate | `config/validate-publish-quality.ts`, `save-setup.ts` | §2 #123 |
| Manifest reconciliation | `wizard-v3-manifest-builder.ts` | §A + §2 #147 |
| Delegation generation bump | `goal-invalidation.ts` | §4 #146 |
| Deterministic field rules (missing module) | `voice-receptionist-wizard/deterministic-rules.ts` | infra |

## Disposition summary (numbered items)

- **IMPLEMENTED:** Qualification, urgency, service policy, holidays in FIND, on-call escalation transfer path, callback SLA persistence, REQUEST_ONLY submit flow, booking SMS, outbound SMS resolver, AI recovery SMS hook, publish quality gate (env-gated hard block), operating policy compile extensions, voicemail detect flag on transfer plan.
- **ALREADY IMPLEMENTED — MANIFEST FIXED:** Booking link, warm transfer, spam/solicitor, transfer plan steps, booking behavior rows, outbound SMS telephony fields, appointment type compile rows.
- **INTENTIONALLY HIDDEN FROM V1:** CRM (`crmEnabled`), Calendly V3 executor (strategy remains NI except wizard derive), generic supervisor/barge.
- **LEGACY PRESERVED — NOT ACTIVE V3:** Voice V2 PSTN assistant path unchanged; V3 authority via LiveKit compile boundary.
- **MANUAL PRODUCTION CERTIFICATION:** All §5 PSTN gates, full §6 Google prod OAuth/PSTN, §7 certification matrix script, §5 transfer PSTN waterfall handset tests.

## Automated tests (this pass)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-qualification-urgency.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-service-policy.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-booking-behavior-policy.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-operating-policy-gating.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-callback-matrix.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-wizard-compiler.ts
```

## Remaining code (explicit)

- Full RAG ingestion/index revision pipeline (document sources compile still `[]` until KB worker wired).
- Calendly V3 provider module or wizard hide (product: hide active V3 promise).
- `take_messages` dedicated tool surface (capability exists; message-taking via callback/request flows).
- V2/V3 publish artifact separation guards in `agent-service` (documented; no V2 deletion).
- Billing meter for V3 voice usage (Stripe SKU wiring).
- Operating maturity rows in manifest still `CONFIGURED_NOT_IMPLEMENTED` where only partial runtime exists (business schedule timezone compiles; full SLA **notifications** not automated).

**End of report.**
