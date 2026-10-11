# V1 Production Certification

**Last updated:** scope freeze — MCTB + Fax only. Verify is **dormant** (preserved, not customer-facing).

## Active V1 products

| Product | Lifecycle | Customer-facing | Launch gate |
|---------|-----------|-----------------|-------------|
| Missed Call Text Back | active | yes | `npm run test:v1-production-readiness` |
| Transovo Fax | active | yes | same |
| Transovo Verify | dormant | no | `npm run test:verify` (non-blocking) |

## Deferred (not V1)

Smart Routing, AI Receptionist, Call Forwarding, add-ons — code preserved, hidden from V1 nav unless `TRANSOVO_V1_SHOW_DEFERRED_NAV=1`.

## Appointment Reminders (separate launch gate — not V1 scope freeze)

| Product | Automated closure | Live prod smoke |
|---------|-------------------|-----------------|
| Appointment Reminders | `npm run test:appointment-reminders` (includes `scripts/test-ar-functional-completion-cert.ts`) | `docs/AR-LAUNCH-READINESS-NOW.md` golden-tenant runbook |

Inventory authority: `docs/AR-FULL-FUNCTIONAL-COMPLETION-MATRIX.md` (**FINISHED** on branch `cursor/ar-full-functional-completion-f350`).

---

## Launch matrix (honest status)

| Area | Automated | Live | Browser | Status |
|------|-----------|------|---------|--------|
| **V1 scope / Verify dormant** | PASS | N/A | N/A | CODE COMPLETE |
| **MCTB core files + consent modes** | PASS | NEEDS HUMAN | NEEDS HUMAN | NOT READY |
| **MCTB billing / A2P** | PARTIAL | NEEDS HUMAN | NEEDS HUMAN | NOT READY |
| **Fax hermetic / Reddit safeguards** | PASS | NEEDS HUMAN | NEEDS HUMAN | NOT READY |
| **Fax routing (/fax vs /overview)** | PASS | N/A | NEEDS HUMAN | CODE COMPLETE |
| **Fax live outbound PSTN** | N/A | **NOT DONE** | N/A | NOT READY |
| **Fax live inbound PSTN** | N/A | **NOT DONE** | N/A | NOT READY |
| **Telnyx fax webhooks (prod)** | N/A | **NOT DONE** | N/A | NOT READY |
| **Stripe fax catalog (live IDs)** | N/A | **NOT DONE** | N/A | NOT READY |
| **Fax Stripe checkout E2E** | N/A | **NOT DONE** | NEEDS HUMAN | NOT READY |
| **Fax authenticated walkthrough** | N/A | N/A | **NOT DONE** | NOT READY |
| **Build (`npm run build`)** | RUN LOCALLY | N/A | N/A | PENDING |

**Final verdict:** **MCTB — NOT READY** · **Fax — NOT READY** (live transport + billing + browser evidence missing)

---

## Automated commands

```bash
npm run test:v1-production-readiness   # V1 gate (MCTB + Fax + routing)
npm run test:verify                    # Dormant Verify preserved code only
npm run test:fax-routing-regression
npm run validate:production-env
npx tsc --noEmit
npm run build
```

MCTB deep matrix: `npx tsx scripts/mctb-launch-readiness-matrix.ts`

---

## Manual live checklist — Fax

1. Log in as test customer with Fax subscription active.
2. Confirm fax number: `________`
3. **Outbound:** Send 1-page PDF to external fax `________`
   - Expect: Preparing → … → Delivered
   - Capture: Transovo fax ID, Telnyx fax ID, timestamps, page count = 1 billable
4. Download delivery confirmation — verify fields match provider state.
5. **Inbound:** From external fax service, send to Transovo number `________`
   - Expect: Inbox, PDF opens, page usage +1 once (duplicate webhook safe)
6. Search for unique string inside document (e.g. `Invoice #927441`).
7. Block sender → confirm in Settings → Blocked Senders → re-test blocked inbound skips AI.
8. **Billing:** Fax → Billing → Cancel at period end — confirm end date shown, number not instantly released.
9. **Port-out:** Request port-out — confirm persisted request + steps shown.

## Manual live checklist — MCTB

1. Complete signup → MCTB plan purchase → entitlement active.
2. Complete onboarding + number/forwarding setup.
3. **Press-1 mode:** Missed call → IVR → DTMF 1 → SMS sent.
4. **Existing-consent mode:** Missed call → SMS without IVR (when configured).
5. Reply to SMS → conversation thread updates.
6. Confirm A2P states shown honestly — no send before approval.
7. Tenant isolation: workspace A cannot see workspace B conversations.

---

## Exact manual actions Cursor cannot complete

- Enter live Stripe secret keys and sync production price IDs (`npm run sync:stripe-platform-catalog`)
- Configure Telnyx Fax Application webhook on production domain
- Place/receive real PSTN fax from external provider
- Physical phone call for MCTB missed-call smoke
- Carrier A2P / TFV approval in provider consoles
- Production domain DNS / OAuth redirect confirmation in external dashboards

---

## Verify reactivation

See `docs/verify-dormant.md`. Set `TRANSOVO_VERIFY_LAUNCH_ENABLED=1` only after commercial review.
