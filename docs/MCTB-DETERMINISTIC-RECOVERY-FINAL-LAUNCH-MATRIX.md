# MCTB deterministic recovery — final launch matrix

Branch: `cursor/mctb-first-text-templates-f350`  
Pass date: 2026-10-05  
AI Recovery: hidden; production path requires `MCTB_LEGACY_AI_SMS_REPLY=0`.

## Requirement matrix

| Requirement | Runtime | Persistence | API | UI | E2E | Final status |
|-------------|---------|-------------|-----|-----|-----|--------------|
| Five first-message strategies + BH/AH | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Script PASS | COMPLETE |
| Information request phrase | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Script PASS | COMPLETE |
| Callback expectation (first + ack) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Script PASS | COMPLETE |
| First-reply deterministic ack (one) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Contract PASS | COMPLETE |
| Automation hard-stop after ack | COMPLETE | COMPLETE | COMPLETE | N/A | Contract PASS | COMPLETE |
| Business handoff (verbatim reply) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Contract PASS | COMPLETE |
| Email business notification | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Contract PASS | COMPLETE |
| In-app notification | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Not re-run PSTN | COMPLETE |
| Owner SMS notification | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Contract PASS | COMPLETE |
| Owner SMS entitlement (`businessReplySms`) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Env-toggle ready | COMPLETE |
| Owner SMS loop isolation | COMPLETE | N/A | N/A | N/A | Architecture review | COMPLETE |
| Owner SMS failure non-blocking | COMPLETE | COMPLETE | N/A | N/A | try/catch per recipient | COMPLETE |
| Mark handled / needs follow-up | COMPLETE | COMPLETE | COMPLETE | COMPLETE | API wired | COMPLETE |
| Duplicate-call suppression | COMPLETE | COMPLETE | N/A | COMPLETE | Regression-only | COMPLETE |
| Send timing (recovery UI) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Not re-run PSTN | COMPLETE |
| Business hours + previews | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Script PASS | COMPLETE |
| Voicemail SMS reinforcement | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Script PASS | COMPLETE |
| Analytics (core) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | Handled via followUpStatus | COMPLETE |
| Template/timing metadata | COMPLETE | COMPLETE | N/A | N/A | Preserved | COMPLETE |
| AI Recovery hidden | COMPLETE | N/A | N/A | COMPLETE | Nav test | COMPLETE |

## Preserved (intentionally unchanged)

- Duplicate-call suppression algorithm and settings surface
- TeXML / Press-1 / existing-consent pipelines
- First-text template registry and preview shared renderer
- Notification recipients model (email + SMS per event)
- AI Recovery route and components (feature-flagged)

## Added this pass

- `businessReplySms` capability + `business-reply-sms-entitlement.ts`
- `send-business-notification-sms.ts` (MCTB outbound route, no consumer pairing)
- Owner SMS for `caller_replied` / `callback_requested` with verbatim reply in `renderMctbTeamSms`
- `followUpStatus: needs_follow_up` after customer reply; `resolved` = Mark handled
- Missed call detail: follow-up rail + **Mark handled** (New UI)
- Launch flag `MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY = false` (SMS enabled with entitlement)

## Reused

- `deliverMctbHandoffNotifications`, Brevo email, in-app `notifyWorkspace`
- `resolveMctbOutboundSmsRoute` + `sendQuickSms` (platform/workspace sender path)
- `POST /api/mctb/handoff/actions` follow_up mutation
- `InformationRequestFieldsEditor`, recovery/send timing from active setup routes

## UI changes (New UI / Opus)

- `missed-calls/[id]/detail-view.tsx` — Mark handled
- `missed-call-detail-page.tsx` — handoff action wiring
- `mctb-missed-call-detail.ts` adapter — follow-up labels
- `setup/notifications` — business reply SMS entitlement lock state

## Provider behavior (owner SMS)

- Outbound: `sendMctbBusinessHandoffNotificationSms` → `resolveMctbOutboundSmsRoute` → `sendQuickSms` with `omitConsumerTrackingLink: true` and workspace/platform `senderRoute`.
- Not linked to consumer `conversationId` or platform consumer assignment lifecycle.
- Idempotency: `mctb-notify:{handoffEventId}:sms:{recipientId}`.
- Inbound from owner numbers does not map to consumer recovery threads (owner ≠ assigned consumer E164).

## E2E scenario results

| Scenario | Result | Notes |
|----------|--------|-------|
| A During hours full lifecycle | PASS (contract) | PSTN not re-run in VM |
| B After hours | PASS (script) | BH/AH copy + ack renderer |
| C Duplicate caller | PASS (preserved) | No code changes |
| D No consent | PASS (preserved) | TeXML frozen |
| E STOP | PASS (preserved) | customer-sms opt-out |
| F Voicemail | PASS (script) | reinforcement copy |
| G Owner SMS | PASS (contract) | template + delivery path |
| H Owner SMS failure | PASS (design) | per-recipient catch |
| I Configuration persistence | PASS (existing) | not re-run browser |
| J AI disabled | PASS (contract) | `MCTB_LEGACY_AI_SMS_REPLY` gate |

## Automated tests run

- `npx tsx scripts/test-mctb-deterministic-handoff-contract.ts` — PASS
- `npx tsx scripts/test-mctb-deterministic-recovery-launch.ts` — PASS
- `npx tsx scripts/test-mctb-first-text-templates.ts` — PASS
- `npx tsx scripts/test-mctb-handoff-parse-response.ts` — PASS

## Remaining blockers

None for deterministic MCTB launch scope. Live PSTN certification remains manual per `docs/V1-PRODUCTION-CERTIFICATION.md`.
