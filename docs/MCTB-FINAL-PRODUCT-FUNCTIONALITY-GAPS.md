# MCTB final product functionality — evidence matrix

**Governance:** This file tracks **evidence only** for the **MCTB Final Commercial Launch Pass** (`docs/MCTB-COMMERCIAL-LAUNCH-PASS.md`). It is **not** a piece-by-piece execution queue. One continuous task: finish MCTB until `MCTB_COMMERCIAL_LAUNCH_CERTIFICATION: COMPLETE` or a **genuine user/external blocker**.

**Authority (commercial):**

| Concern | Module |
|--------|--------|
| Capabilities | `src/lib/mctb/capabilities.ts` — `resolveMctbCapabilities()` |
| Usage (`MCTB_RECOVERY`) | `src/lib/mctb/recovery-usage.ts` |
| Platform templates | `src/lib/mctb/platform-message-templates.ts` |
| Existing Consent certification | `src/lib/mctb/existing-consent-certification-copy.ts` + `capture/attestation.ts` |
| Commercial add-ons | `src/lib/mctb/commercial-entitlements.ts` + `commercial-entitlement-grants.ts` |
| Urgent / notifications | Handoff stack — `classifyMctbUrgentReply`, single-pass `deliverMctbHandoffNotifications` |

**Frozen:** Pure Opus · `mctb_texml_final_v1` · both consent branches.

**Product tiers (final):**

- **Free:** Press-1, platform sender, locked templates, 25 `MCTB_RECOVERY`/mo, caller reply, Brevo normal reply email. No Existing Consent, booking links, urgent, AI Recovery, own sender.
- **Recovery paid:** Higher allowance (250/750/2500), Existing Consent + certification, booking links, urgent classification, urgent Brevo email, urgent **business** SMS. Does **not** include AI Recovery.
- **AI Recovery:** Separate entitlement (`mctb_ai_recovery` / `aiRecoveryEntitled`).
- **Own Sender:** Separate add-on (`mctb_own_sender` / `ownSenderAddOnEntitled`), combinable with Recovery or AI Recovery.

**Urgent business SMS entitlement (final):** `canSendMctbUrgentBusinessTeamSms` → `(await resolveMctbCapabilities(ws)).urgentBusinessSms` (Recovery paid). **Not** `hasActiveMctbPaidEntitlement` alone.

---

## Completed central architecture (do not regress)

| Flag | Status | Evidence |
|------|--------|----------|
| `MCTB_USAGE_FREE_ALLOWANCE` | **COMPLETE** | `recovery-usage.ts`; `MCTB_RECOVERY`; `scripts/test-mctb-recovery-usage-idempotency.ts` — free 25, 25th ok, replay idempotent, 26th suppressed; paid `MCTB_PAID_RECOVERY_LIMIT_BY_TIER` 250/750/2500 |
| `MCTB_CAPABILITIES_RESOLVER` | **COMPLETE** | `resolveMctbCapabilities()`; `scripts/test-mctb-capabilities-resolver.ts` |
| `MCTB_AI_RECOVERY_ENTITLEMENT` | **COMPLETE** (API) | `aiRecoveryEntitled`; `scripts/test-mctb-ai-recovery-entitlement-gate.ts`; Stripe `mctb_ai_recovery` grants |
| `MCTB_CONSENT_PRESS_1` | **COMPLETE** (runtime) | Frozen TeXML; preserve |

Automated guard bundle: `bash scripts/run-mctb-commercial-launch-guards.sh`

---

## Summary flags (open until evidenced)

| Flag | Status | Notes |
|------|--------|--------|
| `MCTB_MISSED_CALL_DETAIL` | Open | Prod multi-state proof |
| `MCTB_PLATFORM_RECOVERY_TEMPLATE` | Open | UI + Setup API + send runtime |
| `MCTB_CUSTOMER_OWNED_RECOVERY_TEMPLATE` | Open | Entitled own sender only |
| `MCTB_COOLDOWN_UI_RUNTIME` | Open | Verify checklist |
| `MCTB_REPLY_EMAIL_NOTIFICATIONS` | Open | Brevo + delivery rows |
| `MCTB_URGENT_AI_CLASSIFIER` | Open | Semantic `classifyMctbUrgentReply`; AI Recovery OFF |
| `MCTB_URGENT_CONVERSATION_STATE` | Open | Inbox Pill + context |
| `MCTB_URGENT_SMS_ENTITLEMENT` | Open | `urgentBusinessSms` via capabilities (Recovery paid) |
| `MCTB_URGENT_RECIPIENT_VALIDATION` | Open | Save + runtime |
| `MCTB_URGENT_CLASSIFIER_FAILURE_FALLBACK` | Open | `classifier_unavailable` → `caller_replied` |
| `MCTB_URGENT_CHANNEL_FAILURE_ISOLATION` | Open | Per-channel delivery |
| `MCTB_WORKSPACE_INGRESS_PROVISIONING` | Open | Fresh workspace lifecycle |
| `MCTB_CONSENT_EXISTING` | Open | Certification + PSTN (user phone if needed) |
| `MCTB_END_TO_END_FUNCTIONALITY` | Open | Full §38 + four customer lifecycles |
| `MCTB_COMMERCIAL_LAUNCH_CERTIFICATION` | Open | Production on certified commit |

---

## Recovery template — two paths

| Path | Persistence | Opus UI | Server enforcement | Runtime |
|------|-------------|---------|-------------------|---------|
| Platform sender | `senderMode=PLATFORM` | Locked Text Back | Setup POST strips `messageTemplate` when PLATFORM | `resolveMctbRecoveryOpenerTemplate()` |
| Customer-owned | `messageTemplate` when entitled | Editable Text Back | Requires `ownSenderAddOnEntitled` + verified sender | Custom template in send |

**Inbox composer:** Must respect `manualTwoWayMessaging` / platform policy (same tranche).

---

## Cooldown — verify-only

| Step | Expected |
|------|----------|
| 1–7 | Setup save → reload → eligibility uses `cooldownMinutes`; repeat caller suppressed inside window |

Do not redesign cooldown unless verification fails.

---

## `caller_replied` + urgent (single pass)

```
Inbound SMS → persist → side effects → handoff event → deliverMctbHandoffNotifications
  → matrix[eventType] (caller_replied | urgent_detected — not duplicate emails)
  → Brevo email + mctbNotificationDelivery idempotency
  → business SMS when urgentBusinessSms entitled + matrix allows
```

Urgent: semantic classifier on business instructions; failure → `caller_replied` notify path.

---

## Consent — split certification

| Mode | Runtime |
|------|---------|
| Press-1 | Frozen TeXML |
| Existing consent | Attestation + Recovery paid + frozen branch |

---

## Gap table (feature rows)

| Feature | Backend | Opus UI | Gap |
|---------|---------|---------|-----|
| Pure Opus shell | Yes | Yes | Preserve |
| Missed calls / detail | Yes | Yes | Prod evidence |
| Platform recovery template | Partial | Locked | E2E |
| Customer-owned template | Yes | Editable | E2E + entitlement |
| Own sender TFN/10DLC | Yes | Setup | Workflow + EXTERNAL_APPROVAL_PENDING per number |
| Recovery delay / cooldown / pause | Yes | Yes | Runtime proof |
| Notifications / Brevo | Yes | Matrix | Delivery proof |
| Urgent AI + business SMS | Yes | Notifications | E2E |
| Existing consent | Yes | Certification UI | PSTN if user required |
| Ingress provisioning | Partial | Phone | Fresh workspace |
| STOP/HELP | Yes | — | §38 |
| AI Recovery runtime | Yes | `/mctb/ai-recovery` | Entitled runtime proof |
| Billing / Stripe add-ons | Partial | — | Checkout + downgrade |

---

## Code reference (recent)

Missed call detail · platform template · caller_replied path · urgent orchestration · capabilities · recovery usage — see `docs/MCTB-COMMERCIAL-LAUNCH-PASS.md` and git history on `master`.

---

## Verification commands

```bash
bash scripts/run-mctb-commercial-launch-guards.sh
npx tsx scripts/test-mctb-platform-inbound-tenant-isolation.ts  # with preload in guards script
npm run verify:mctb-final-pipeline
```

Production: `GET /api/health` → `commitSha` must match certified deploy before prod evidence.

---

## Functional proof evidence log

| Step | Flag(s) | Status | Evidence |
|------|---------|--------|----------|
| Deploy + health SHA | — | Open | `/api/health` commit |
| Missed-call detail prod | `MCTB_MISSED_CALL_DETAIL` | Open | |
| caller_replied Brevo | `MCTB_REPLY_EMAIL_NOTIFICATIONS` | Open | |
| Urgent E2E | urgent flags | Open | |
| Fresh workspace ingress | `MCTB_WORKSPACE_INGRESS_PROVISIONING` | Open | |
| Four customer lifecycles | `MCTB_END_TO_END_FUNCTIONALITY` | Open | |

**Classifier failure:** `classification: classifier_unavailable` → notifications use `caller_replied` routing.
