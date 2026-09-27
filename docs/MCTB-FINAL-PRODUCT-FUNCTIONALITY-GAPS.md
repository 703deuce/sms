# MCTB final product functionality — gap matrix

**Status:** Gap-closing pass (extend Opus baseline — do not rebuild MCTB)  
**Baseline:** Commit `7c97075f` deployed; Sept 27 production Opus browser smoke (17/17 routes, real data). **Preserve Pure Opus shell + frozen TeXML (`mctb_texml_final_v1`).**

**Not launch certification:** UI smoke PASS ≠ commercial launch. Full functional matrix (§38) must pass before “commercially launch-certified.”

**Out of scope (unless verification fails):** PWA `manifest.webmanifest` / `sw.js` 404s; cosmetic save toasts; cooldown code changes (verify-only).

---

## Execution order (locked for this pass)

1. **Deploy + production re-test** missed-call detail (multiple real rows / states).
2. **Trace + verify** `caller_replied` → email (and matrix routing) — repair existing path; no parallel notification subsystem.
3. **Urgent AI** + Setup → Notifications UI + entitled business SMS alert (extends inbound-reply lifecycle).
4. **Verify cooldown** end-to-end → mark `MCTB_COOLDOWN_UI_RUNTIME: COMPLETE` and stop touching cooldown code.
5. **Audit** authoritative usage / free allowance (no `FREE_LIMIT = 25` hack).
6. **Audit + test** fresh-workspace ingress provisioning (not “this workspace has an 866”).
7. **Finish** sender ownership / template policy (platform vs customer-owned), including Inbox composer entitlement.
8. **Run** full functional matrix.

---

## Summary flags

| Flag | Status | Notes |
|------|--------|--------|
| `MCTB_MISSED_CALL_DETAIL` | **PARTIAL** | Loader/API fix on branch; **prod re-test** multiple row states before COMPLETE |
| `MCTB_PLATFORM_RECOVERY_TEMPLATE` | **PARTIAL** | Resolver + locked Text Back UI; certify UI → API → persistence → runtime |
| `MCTB_CUSTOMER_OWNED_RECOVERY_TEMPLATE` | **PARTIAL** | `messageTemplate` editable; certify persistence + runtime uses custom value |
| `MCTB_COOLDOWN_UI_RUNTIME` | **PARTIAL — VERIFY ONLY** | No more code unless functional test fails |
| `MCTB_REPLY_EMAIL_NOTIFICATIONS` | **PARTIAL** | Trace below; wire/repair before urgent |
| `MCTB_URGENT_AI_CLASSIFIER` | **MISSING — REQUIRED THIS PASS** | Extend `caller_replied` path; reuse existing structured AI where possible |
| `MCTB_WORKSPACE_INGRESS_PROVISIONING` | **PARTIAL** | Needs **new-workspace** lifecycle proof + failure semantics |
| `MCTB_USAGE_FREE_ALLOWANCE` | **AUDIT FIRST** | Find authoritative package/entitlement/usage — do not add independent counter |
| `MCTB_CONSENT_PRESS_1` | **IMPL COMPLETE** | Frozen TeXML; historical/live evidence; preserve |
| `MCTB_CONSENT_EXISTING` | **VERIFY** | UI smoke ≠ PSTN runtime cert; launch matrix for `existing_consent` branch |
| `MCTB_END_TO_END_FUNCTIONALITY` | **MISSING** | §38 matrix not run |

---

## Recovery template — two certified paths (do not combine as one COMPLETE)

| Path | Persistence | Opus UI | Server enforcement | Runtime consumer | Certified? |
|------|-------------|---------|-------------------|------------------|------------|
| **Transovo platform sender** | `senderMode=PLATFORM`; workspace `messageTemplate` must not override outbound recovery copy | Locked preview; no free-form save of recovery body | Setup POST already strips unauthorized template; GET overlays approved copy | `resolveMctbRecoveryOpenerTemplate()` in send path | **NO** — prove PSTN/SMS + API rejection of custom copy |
| **Customer-owned sender** | `messageTemplate` in workspace/MCTB config | Editable Text Back; save persists | Policy must require entitled sender | Send uses customized `messageTemplate` | **NO** — prove edit → save → reload → outbound body |

**Policy mistake to avoid:** A single row “Text Back opener = COMPLETE” while platform lock is still PARTIAL.

**Inbox composer:** Platform sender must not allow composing recovery copy that bypasses policy — same certification tranche as template rows.

---

## Cooldown — verify-only checklist

**Do not redesign cooldown** unless a step below fails.

| Step | Expected |
|------|----------|
| 1 | Set cooldown to **3 hours** in Setup → Recovery; save |
| 2 | Hard refresh → still **3 hours** |
| 3 | Runtime reads `cooldownMinutes` (→ `cooldownSeconds` in eligibility) |
| 4 | First eligible recovery for caller A succeeds |
| 5 | Second qualifying missed call from A **inside** 3h → suppressed with **cooldown** reason (prove event/reason) |
| 6 | Outside boundary eligible again — use controlled test data/time, not literal 3h wait if possible |
| 7 | Change workspace to another duration → runtime follows new value |

**If all pass:** `MCTB_COOLDOWN_UI_RUNTIME: COMPLETE` — leave code alone.

---

## `caller_replied` notification trace (audit — settle before urgent)

**Product rule:** Urgent escalation extends this pipeline — not a second parallel notification system.

```
Inbound consumer SMS (Telnyx)
  → src/lib/agents/missed-call-text-back/customer-sms.ts
  → handleMctbLeadRecoveryInboundSms (persist reply, AI recovery path)
  → recordMctbLeadRecoveryInboundSideEffects
       → recordMctbHandoffEvent(eventType: caller_replied)
       → deliverMctbHandoffNotifications
            → routingMatrix[eventType] from loadMctbHandoffConfig
            → email: notifyWorkspaceByEmail + mctbNotificationDelivery
            → SMS/in_app per matrix + recipient channels
```

**Setup → Notifications:** Opus matrix includes `caller_replied` (`setup-pages.tsx` / `setup-notifications-model.ts`). Runtime consumer: `config.routingMatrix` in `deliverMctbHandoffNotifications`.

**Legacy path (not production customer SMS):** `processMctbInboundReply` — comment: Telnyx customer SMS does **not** call this; use `recordMctbLeadRecoveryInboundSideEffects`.

**Remaining verification (not yet closed):**

- Prove email delivery for `caller_replied` with matrix toggles and real recipient.
- Confirm idempotency (`mctb-handoff:…:caller_replied` + `mctb-notify:…:email:…`).
- Document whether `MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY` affects in-app vs email in prod.
- **Then** attach urgent classifier after normal reply notification lifecycle.

**Desired relationship:**

```
Inbound reply ──┬→ normal email (and matrix channels)
                └→ if urgent alerts enabled → AI classifier → extra escalation (email + entitled business SMS)
```

---

## Urgent AI — REQUIRED THIS PASS

**Status:** `MCTB_URGENT_AI_CLASSIFIER: MISSING — REQUIRED THIS PASS` (not deferred).

**Reuse:** Lead Recovery already produces `StructuredLeadIntent`; `assessMctbUrgencyFromStructuredIntent` maps intent + `emergencyCriteria` to urgent/normal. Do **not** add a unrelated second AI stack if existing structured-output path can carry `urgentInstructions` + latest message + context.

**Target contract:**

1. Inbound reply → compliance/routing → persist message  
2. Normal `caller_replied` notification lifecycle (above)  
3. If urgent alerts enabled → classifier → structured `{ urgent, reason, summary }` → persist  
4. If urgent → mark conversation/message visible urgent → email per config → **entitled** business SMS to emergency recipient(s)

**Configuration home:** Setup → Notifications only (no `/setup/urgent` unless architecture forces it):

- Urgent Reply Alerts ON/OFF  
- “What should Transovo consider urgent?” (instructions textarea)  
- Urgent email behavior  
- Urgent business SMS ON/OFF + recipient(s)  
- **Test Urgent Rules** — same production classifier; must NOT create consumer conversation, send consumer SMS, send real emergency alert, or mutate production conversation state; returns Urgent/Normal + concise reason

**Gap vs today:** Urgency is partially tied to Lead Recovery intent + keyword/criteria matching; product wants explicit urgent-instructions-driven AI classification on every inbound reply when enabled, with visible UI + business SMS entitlement separated from customer recovery quota.

---

## Usage / free ~25 — audit first

**Do not** introduce `FREE_LIMIT = 25` or a second counter.

| Step | Action |
|------|--------|
| 1 | Locate authoritative package, entitlement, usage accounting, billing period, enforcement |
| 2 | Document what currently counts (recoveries vs messages vs segments vs conversations) |
| 3 | Map product intent (~25 free MCTB recoveries / monthly period) onto **one** system |
| 4 | Ensure business urgent-alert SMS does **not** consume customer MCTB recovery allowance unless explicitly designed |

**Matrix status:** `AUDIT FIRST` — not MISSING with a guessed implementation.

---

## Ingress auto-provision — new workspace proof

Showing **(866) 602-0680** on an **existing** workspace does **not** certify auto-provision.

| Required proof | |
|----------------|--|
| New eligible MCTB workspace → provisioning requested → DID acquired/assigned → TeXML app/routing → workspace association → onboarding shows real forwarding target | |
| Provider failure → no fake success → no instructions to unusable DID → retryable state → no duplicate purchase on retry/refresh | |

**Status:** PARTIAL until controlled new-workspace test (or traced lifecycle doc + failure semantics).

---

## Consent — split certification

| Mode | Implementation | Runtime evidence | Matrix status |
|------|----------------|------------------|---------------|
| **Press-1** | Frozen TeXML pipeline | Historical/live PSTN evidence | Preserve; do not rewrite TeXML |
| **Existing consent** | Implementation exists | **Needs** launch lifecycle: attestation UI, entitlement, voicemail/capture/SMS on frozen branch | **VERIFY** — Consent page smoke does not certify PSTN |

---

## Gap table (feature rows)

| Feature | Backend | Persistence | Runtime consumer | Opus UI | Runtime verified | Gap | Action |
|---------|---------|-------------|------------------|---------|------------------|-----|--------|
| Pure Opus Stage 2 shell | Yes | — | — | Yes | Smoke PASS | COMPLETE | Preserve |
| Missed calls list | Yes | DB | Yes | Yes | Smoke PASS | COMPLETE | Preserve |
| Missed call detail | Yes | DB | Yes | Yes | Was FAIL prod | **PARTIAL** | Prod re-test multiple states |
| Conversations / inbox | Yes | DB | SMS | Yes | Smoke (no send) | PARTIAL | Send + entitlement |
| **Platform recovery template** | Partial | `senderMode` | `resolveMctbRecoveryOpenerTemplate` | Locked Text Back | Not proven E2E | **PARTIAL** | Certify full path |
| **Customer-owned recovery template** | Yes | `messageTemplate` | send | Editable Text Back | Not proven E2E | **PARTIAL** | Certify edit→runtime |
| Customer-owned sender / TFN / 10DLC | Yes | Numbers/A2P | send | Setup/Numbers | Not in smoke | PARTIAL | Audit upgrade |
| Recovery delay | Yes | `delaySeconds` | eligibility | Recovery | Not re-tested | PARTIAL | §37 test |
| Cooldown | Yes | `cooldownMinutes` | eligibility | Recovery dropdown | Not re-tested | **PARTIAL — verify only** | Checklist above |
| Pause / resume | Yes | schedule | `recovery_paused` | Recovery | Not in smoke | PARTIAL | Test semantics |
| Notifications / handoff | Yes | `/api/mctb/handoff` | `deliverMctbHandoffNotifications` | Setup → Notifications | Trace incomplete | PARTIAL | Verify `caller_replied` email |
| Reply email on customer reply | Partial | handoff + matrix | `recordMctbLeadRecoveryInboundSideEffects` | Matrix toggle | Not verified | PARTIAL | Trace + prove delivery |
| **Urgent AI + business SMS** | Partial | assessments | side-effects + notifications | **Notifications** | No | **REQUIRED** | Build on caller_replied path |
| Exclusions | Yes | API | eligibility | Setup | Not in smoke | PARTIAL | Runtime proof |
| Consent Press-1 | Yes | setup + TeXML | frozen | Setup | Live evidence | **IMPL COMPLETE** | Preserve TeXML |
| Consent existing | Yes | attestation | frozen branch | Setup | Not in launch matrix | **VERIFY** | PSTN lifecycle test |
| Voicemail | Yes | API | TeXML | Inbox + setup | Empty inbox OK | PARTIAL | `existing_consent` path |
| Setup Test / live test | Yes | live-test API | ingress | Test | Not started smoke | PARTIAL | Real chain |
| Usage / free allowance | ? | billing/entitlement | ? | ? | No | **AUDIT FIRST** | No new counter |
| Ingress auto-provision | Partial | workspace | onboarding | Phone | Existing 866 only | PARTIAL | New-workspace proof |
| STOP/HELP | Yes | suppression | send gates | — | Not in smoke | PARTIAL | §38 |
| AI Recovery (conversational) | Yes | lead-recovery | SMS AI | `/mctb/ai-recovery` | Smoke PASS | PARTIAL | Distinct from urgent alert product |

---

## Code landed (initial tranche — branch `cursor/mctb-final-product-gaps-2304`)

| Item | Files |
|------|--------|
| Missed call detail | `missed-call-detail-load.ts`, API route, Opus detail page, adapter |
| Platform template (partial cert) | `message-template.ts`, `send.ts`, setup GET, `text-back-editor.tsx` |
| Cooldown UI options | `setup-pages.tsx`, `setup/recovery/page.tsx` |

---

## Verification commands

```bash
npx tsx src/lib/mctb/message-template.test.ts
npm run verify:mctb-stage2-presentation
npm run verify:mctb-stage2-demo-state
npm run audit:mctb-opus-page-wiring
```

After deploy: production-click missed-call detail rows (recovery sent, suppressed, with/without conversation, older/newer).
