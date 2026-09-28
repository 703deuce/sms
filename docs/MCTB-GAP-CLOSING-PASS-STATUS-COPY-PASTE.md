# MCTB gap-closing pass — status & proof checklist (single copy-paste file)

**Generated / updated:** 2026-09-28 (UTC)  
**Full gap matrix (authoritative):** `docs/MCTB-FINAL-PRODUCT-FUNCTIONALITY-GAPS.md`  
**Production browser smoke (Sept 27):** `docs/MCTB-PRODUCTION-TEST-ALL-RESULTS-COPY-PASTE.md`

---

## Policy (do not move goalposts)

- **Extend** Pure Opus MCTB baseline — do **not** rebuild MCTB or parallel notification stacks.
- **Do not redesign** urgent architecture after `680105af` — **prove** it.
- UI smoke PASS ≠ commercial launch. Close matrix rows only from **end-to-end evidence**.
- Legacy `processMctbInboundReply` is **not** production Telnyx customer SMS — do not “fix” notifications there.
- Press-1 TeXML: **preserve** (`mctb_texml_final_v1`). Cooldown: **verify-only** (no code unless test fails).

---

## Git / deploy (as of last agent update)

| Item | Value |
|------|--------|
| Branch merged | `cursor/mctb-final-product-gaps-2304` → `master` |
| Gap-closing commit (feature) | `680105af` (urgent tranche + detail + platform template + caller_replied fix) |
| Doc commit (deploy note) | `74a9b8f4` |
| Production health (last check) | `GET /api/health` (production) → `commitSha` still **`8c118a86`** — **wait for Coolify** before functional proof |
| Re-check deploy | `curl -sS "$APP_URL/api/health"` must show `680105af…` (or newer on `master`) |

---

## What landed (architecture — do not rebuild)

### caller_replied (production path)

```
Inbound consumer SMS (Telnyx)
  → acceptMctbInboundSmsIngress (persist + job)
  → processMctbInboundSmsJob
  → handleMctbCustomerSmsReply (customer-sms.ts)
       ├─ AI Lead Recovery OFF → recordMctbLeadRecoveryInboundSideEffects only (`mctb_notifications_only`)
       └─ AI Lead Recovery ON  → handleMctbLeadRecoveryInboundSms → side effects → optional consumer SMS
  → processMctbInboundReplyHandoff (inbound-reply-handoff.ts)
       → classify when Urgent Reply Alerts enabled (urgent-reply-classifier.ts)
       → recordMctbHandoffEvent(caller_replied) [per providerMessageId]
       → deliverMctbHandoffNotifications (single pass: caller_replied | urgent_detected | callback_requested)
            → routingMatrix[eventType]
            → email: notifyWorkspaceByEmail + mctbNotificationDelivery
            → launch: MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY skips in_app; email still runs when matrix allows
```

**Fix:** Handoff no longer blocked when Lead Recovery disabled (`869f33b6`).

### Urgent Reply Alerts (notification product — not consumer SMS)

| Piece | Path |
|-------|------|
| Semantic classifier | `src/lib/mctb/handoff/urgent-reply-classifier.ts` |
| Orchestration | `src/lib/mctb/handoff/inbound-reply-handoff.ts` |
| One-pass routing | `src/lib/mctb/handoff/inbound-reply-notification-plan.ts` |
| Test API (no consumer SMS/alerts) | `POST /api/mctb/handoff` `action: "test_urgent_rules"` |
| Setup UI | `mirror/routes/mctb/setup/notifications/page.tsx` + `setup-pages.tsx` wiring |
| Config fields | `emergencyDetectionEnabled` (ON/OFF), `emergencyCriteria` (instructions) |
| Business SMS entitlement | `urgent-business-sms-entitlement.ts` → `hasActiveMctbPaidEntitlement`; runtime suppress + UI disable on `urgent_detected` SMS |

### Urgent runtime requirements (locked)

1. **Independent of AI Recovery** — urgent + caller_replied handoff on qualified inbound; LR only gates **outbound** conversational SMS.
2. **No extra consumer SMS** from urgency (platform sender boundary).
3. **Single notification orchestration** — classify then one `deliverMctbHandoffNotifications`; not normal + urgent email for same inbound.
4. **Instructions = semantic authority** — AI structured `{ urgent, reason, summary }`; not keyword-only reuse of old Lead Recovery urgency helpers.

### Other code on master

- Missed-call detail: `missed-call-detail-load.ts`, API route, Opus detail page.
- Platform recovery template: `resolveMctbRecoveryOpenerTemplate`, locked Text Back when PLATFORM.
- Cooldown UI options (verify-only): Recovery dropdown expanded.

---

## Locked execution order (proof, not more architecture)

1. Deploy + verify `/api/health` commit.
2. Prod re-test missed-call detail (multiple real row states).
3. Prove real `caller_replied` email (workspace + recipient + full chain).
4. Prove urgent settings persist (save + hard refresh; tenant isolation).
5. Prove Test Urgent Rules (UI + same classifier as production; no side effects).
6. Prove urgent with **AI Recovery OFF**.
7. Prove **NORMAL** inbound (urgent enabled) — one email, not falsely urgent.
8. Prove **URGENT** inbound — assessment + urgent email + entitled business SMS; no consumer SMS.
9. Business SMS entitlement (server + runtime) — **partially implemented**; prove entitled vs not.
10. Idempotency replay (same provider message ID).
11. Close urgent/email flags only with evidence (see matrix).
12. Then: cooldown verify → usage audit → ingress new-workspace → template/composer → existing consent → §38 matrix.

**Do not** substitute another generic 17-page UI smoke for steps 2–10.

---

## OPUS UI compliance (before / after deploy)

```bash
npm run verify:mctb-stage2-presentation   # must be PURE_OPUS
npm run verify:mctb-stage2-demo-state
npm run audit:mctb-opus-page-wiring
```

Urgent UI uses existing Opus mirror patterns (`Panel`, `FieldRow`, `Pill`, `Checkbox`, `Textarea`, `Button`) in `mirror/routes/mctb/setup/notifications/page.tsx` — not a separate design system.

Full component audit table: see **OPUS UI compliance** section in `docs/MCTB-FINAL-PRODUCT-FUNCTIONALITY-GAPS.md`.

---

## Functional proof evidence log (fill in as you test)

| Step | Flag(s) | Status | Evidence to capture |
|------|---------|--------|---------------------|
| 1 Deploy + health | — | PENDING | Coolify green; health `commitSha` |
| 2 Missed-call detail | `MCTB_MISSED_CALL_DETAIL` | PENDING | Row IDs, API, UI per state |
| 3 caller_replied email | `MCTB_REPLY_EMAIL_NOTIFICATIONS` | PENDING | provider ID, handoff event, delivery row, inbox |
| 4 Urgent settings persist | `MCTB_URGENT_NOTIFICATION_UI` | PENDING | screenshots + API GET |
| 5 Test Urgent Rules | classifier test path | PENDING | urgent/normal samples + JSON |
| 6 Urgent, LR off | `MCTB_URGENT_AI_CLASSIFIER` | PENDING | no consumer AI SMS |
| 7 Normal reply | — | PENDING | single email, not urgent UI |
| 8 Urgent reply | `MCTB_URGENT_EMAIL`, `MCTB_URGENT_BUSINESS_SMS` | PENDING | assessment + deliveries |
| 9 SMS entitlement | `MCTB_URGENT_BUSINESS_SMS` | PARTIAL | entitled vs suppressed |
| 10 Idempotency | `MCTB_URGENT_IDEMPOTENCY` | PENDING | idempotency keys |

---

## Automated guards (repo — not E2E proof)

```bash
npx tsx src/lib/mctb/message-template.test.ts
npx tsx scripts/test-mctb-caller-replied-inbound-path.ts
npx tsx scripts/test-mctb-caller-replied-email-delivery-contract.ts
npx tsx scripts/test-mctb-inbound-reply-notification-plan.ts
npm run verify:mctb-stage2-presentation
npm run verify:mctb-stage2-demo-state
npm run audit:mctb-opus-page-wiring
```

---

## Summary flags (quick reference — detail in gap matrix)

| Flag | Status |
|------|--------|
| `MCTB_MISSED_CALL_DETAIL` | PARTIAL — prod re-test |
| `MCTB_PLATFORM_RECOVERY_TEMPLATE` | PARTIAL — certify E2E |
| `MCTB_CUSTOMER_OWNED_RECOVERY_TEMPLATE` | PARTIAL |
| `MCTB_COOLDOWN_UI_RUNTIME` | PARTIAL — verify only |
| `MCTB_REPLY_EMAIL_NOTIFICATIONS` | PARTIAL — prove email |
| `MCTB_URGENT_*` | PARTIAL — prove after deploy |
| `MCTB_USAGE_FREE_ALLOWANCE` | AUDIT FIRST |
| `MCTB_WORKSPACE_INGRESS_PROVISIONING` | PARTIAL — new workspace proof |
| `MCTB_CONSENT_PRESS_1` | IMPL COMPLETE — preserve |
| `MCTB_CONSENT_EXISTING` | VERIFY |
| `MCTB_END_TO_END_FUNCTIONALITY` | MISSING — §38 |

---

## What is NOT in this file

- Full per-feature gap table, cooldown checklist, consent split, ingress requirements, template two-path certification — those are in **`docs/MCTB-FINAL-PRODUCT-FUNCTIONALITY-GAPS.md`** (keep that as source of truth; update evidence there as steps close).
