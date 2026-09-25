# MCTB Pass 1C — Platform Sender Controlled AI & Takeover Race Safety

## 1. Executive verdict

**MCTB PASS 1C COMPLETE — PLATFORM SENDER POLICY ENFORCED** (pending owner certification on live SMS).

Pass 1C closes the runtime gap identified in Pass 1B: AI Lead Recovery no longer sends arbitrary model-authored SMS on the **PLATFORM** sender. Intelligence (intent, collection, policy) is unchanged; **authorship** of platform outbound copy is Transovo-controlled. Customer-owned **WORKSPACE** A2P retains free-form AI replies. Durable outbound jobs re-check automation handoff so stale AI messages cannot land after human takeover (including post-resume).

## 2. Previous failing runtime path

`handleMctbCustomerSmsReply` → `handleMctbLeadRecoveryInboundSms` → `executeLeadRecoveryActions` produced `leadRecovery.reply` (including LLM FAQ via `ANSWER_APPROVED_INFORMATION`) → `enqueueMctbCustomerOutboundSmsJob` / inline `sendMctbCustomerOutboundSms` with that body unchanged, regardless of `senderMode`.

## 3. Final PLATFORM response architecture

Inbound SMS → Lead Recovery (intent/policy/actions) → `resolveMctbAiOutboundSmsBody` → `selectPlatformResponseForLeadRecovery` → `renderPlatformResponseTemplate` → existing MCTB SMS pipeline → platform sender.

## 4. Final WORKSPACE/A2P architecture

When `senderMode !== PLATFORM`, `resolveMctbAiOutboundSmsBody` returns `leadRecovery.reply` unchanged (`usedModelAuthoredText: true`).

## 5. Response registry

Code-owned registry under `src/lib/mctb/platform-sender/`:

- `platform-response-ids.ts`
- `platform-response-registry.ts`
- `map-lead-recovery-platform-response.ts`

## 6. Response IDs

`ACKNOWLEDGE_NEED`, `ASK_NAME`, `ASK_NEED`, `ASK_LOCATION`, `ASK_URGENCY`, `ASK_CALLBACK_TIME`, `CALLBACK_CONFIRMED`, `SEND_BOOKING_LINK`, `HANDOFF_OWNER_FOLLOWUP`, `OPT_OUT_ACK`, `SAFE_FALLBACK`.

## 7. Template variables

Allowlisted only: `businessName`, `bookingUrl`, `callerFirstName`. Renderer rejects unresolved placeholders and missing required variables (fail closed → `SAFE_FALLBACK` at resolver boundary).

## 8. AI structured decision contract

Existing Lead Recovery `policy.nextActions` + `runtime.action` drive `PlatformResponseId` selection. The model does not approve or author final platform SMS bodies.

## 9. Platform fail-closed behavior

Render/selection errors log a warning and send `SAFE_FALLBACK` — never model `reply` text on PLATFORM.

## 10. Booking-link behavior

`SEND_BOOKING_LINK` requires `hasMctbAiBookingEntitlement` and a resolved booking URL; otherwise `HANDOFF_OWNER_FOLLOWUP`. `AI_BOOK` / `ai_booking_*` actions map to booking link on platform when entitled, not slot selection.

## 11. Business-information question behavior

`approved_info` / `ANSWER_APPROVED_INFORMATION` map to `SAFE_FALLBACK` on platform (no LLM-authored FAQ SMS). Richer FAQ remains on WORKSPACE A2P.

## 12. Owner-approved response behavior

Inbox manual platform send remains blocked via Pass 1B `assertMctbInboxOutboundAllowed`. No customer catalog of platform templates in this pass.

## 13. Free behavior

Free + PLATFORM: no booking link response; no arbitrary AI SMS; controlled collection prompts only.

## 14. Paid platform behavior

Paid + entitled: `SEND_BOOKING_LINK` when URL exists. Still no arbitrary AI/human platform composer.

## 15. Customer A2P behavior

WORKSPACE path unchanged for AI reply text and inbox composer (Pass 1B gates preserved).

## 16. Manual-send authorization

Pass 1B `ensureMctbHumanOwnershipBeforeManualSend` unchanged.

## 17. Takeover race before

Manual send set `human_active` before send, but durable `mctb_send_customer_sms` jobs could still deliver AI text queued earlier.

## 18. Takeover race after

`executeMctbSendCustomerSmsJob` calls `validateMctbAutonomousAiOutboundBeforeSend` before provider send. Suppressed jobs return `{ ok: true, suppressed: true }` and log `OUTBOUND_SUPPRESSED` (not provider failure).

## 19. Stale-job invalidation mechanism

`metadataJson.lastHumanTakeoverAtMs` (monotonic, set on takeover via `mergeLastHumanTakeoverMetadata`) + live `humanTakenOverAt` / `humanTakenOverByUserId` / `shouldBlockAutomation`. Job `enqueuedAt` compared to watermark; survives resume without resurrecting pre-takeover jobs. **No schema migration.**

## 20. Resume behavior

Resume clears active human takeover fields but retains `lastHumanTakeoverAtMs`; jobs enqueued before that watermark stay suppressed.

## 21. Observability

Outbound job logs include `platformResponseId`, `senderMode`, `outboundSource`, suppression reason. Trace kind `OUTBOUND_SUPPRESSED` added.

## 22. Files changed

See git diff on branch `cursor/mctb-pass-1c-platform-ai-2304`.

## 23. Runtime files changed

- `src/lib/agents/missed-call-text-back/customer-sms.ts`
- `src/lib/mctb/platform-sender/*`
- `src/lib/mctb/messaging/send-customer-sms-job.ts`
- `src/lib/mctb/messaging/enqueue-customer-outbound-sms.ts`
- `src/lib/mctb/messaging/ai-outbound-handoff-guard.ts`
- `src/lib/mctb/messaging/automation-handoff-watermark.ts`
- `src/lib/mctb/handoff/automation-state.ts`
- `src/lib/mctb/messaging/inbound-processing-trace.ts`

## 24. Schema changes

None.

## 25. Tests/results

- `npx tsx scripts/test-mctb-pass-1c-platform-ai.ts`
- `npx tsx scripts/test-mctb-pass-1b-sender-authority.ts`
- `npx tsx scripts/test-mctb-pass-1-shell-inbox.ts`

## 26. Remaining blockers

Owner live SMS certification; optional future owner-selectable subset of platform responses in Inbox.

## 27. Owner certification required

Verify on staging/production: platform thread shows only controlled copy; A2P thread still allows AI/manual; takeover during delayed worker suppresses stale AI.
