# MCTB launch audit — ruthless (acquisition path only)

**Date:** 2026-09-27  
**Question:** Can a stranger complete **Ad → signup → setup → CFNA → missed call → Press-1 → SMS delivered** (or `existing_consent` equivalent) and see proof on the dashboard?  
**Method:** Code/route inventory + existing `scripts/test-mctb-*` contracts. **Live PSTN/SMS: NOT RUN** in Cloud Agent.

## Verdict

**MCTB_LAUNCH_STATE: NOT_READY**

Implementation breadth is high; **production proof of the money path is still missing**. Do not spend launch time on Voice or peripheral MCTB surfaces until P0 live smokes pass.

---

## Core journey matrix

| Step | Feature | UI | Backend | Runtime wired | Live test | Status | Gap |
|------|---------|----|---------|---------------|-----------|--------|-----|
| 1 | Ad / landing → signup CTA | PARTIAL | PASS | NOT RUN | Yes | **PARTIAL** | Confirm production URL + MCTB offer; no Voice leakage |
| 2 | Signup + workspace | PASS | PASS | NOT RUN | Yes | **PARTIAL** | `api/auth/signup`; verify MCTB entitlement + plan on create |
| 3 | Login → land `/mctb` | PASS | PASS | PASS | Smoke | **PASS** | `resolvePostLoginPath` + freeze PR |
| 4 | Setup: business line + carrier | PASS | PASS | NOT RUN | Yes | **PARTIAL** | `test-mctb-setup-phone-forwarding`; **carrier CFNA live** |
| 5 | Forwarding verification | PASS | PASS | NOT RUN | Yes | **NOT RUN** | Server-evidence only; no client fake verify |
| 6 | Consent mode (press_1 + existing) | PASS | PASS | NOT RUN | Yes | **NOT RUN** | `test-mctb-consent-modes`; both modes required |
| 7 | Press-1 TeXML + DTMF | N/A | PASS | PASS | Yes | **NOT RUN** | Frozen pipeline; `verify:mctb-final-pipeline` static only |
| 8 | SMS compliance + opener | PASS | PASS | NOT RUN | Yes | **NOT RUN** | Platform sender + templates |
| 9 | Inbound reply + STOP | N/A | PASS | PASS | Yes | **NOT RUN** | Platform sender suppression |
| 10 | Dashboard proof (missed call row) | PASS | PASS | NOT RUN | Yes | **PARTIAL** | `/mctb` + missed-calls list; KPI parity unverified live |

Everything not in this table is **out of scope for launch gating** unless it blocks a row above.

---

## P0 — launch blockers

Only items that **stop the core journey** (or create compliance send risk):

1. **No signed live run:** CFNA to Transovo ingress → missed-call event → Press-1 (or existing_consent SMS) → delivered SMS on a real handset. (**NOT RUN** — blocker until done once per mode you sell.)
2. **Platform sender on production Telnyx:** assign, outbound, inbound STOP at shared sender. Scripts exist; **live NOT RUN**.
3. **Signup → entitled MCTB workspace** without manual ops (wrong product, no sender, stuck off `/mctb`). **Smoke NOT RUN**.
4. **Forwarding “verified” without server evidence** would be P0 if observed in staging/prod (code intends server authority; **verify live**).
5. **Accidental send without consent** in `press_1` mode — runtime guards must hold; **PSTN NOT RUN**.

If any P0 fails in production smoke, **stop acquisition spend** until fixed.

---

## P1 — fix before paid traffic (not blockers for first organic test)

1. Overview KPIs ≠ missed-calls list / detail (trust erosion).
2. Wizard vs `/mctb/setup/*` editors diverge on save/reload.
3. Legacy bookmarks `/voice/setup`, `/voice/missed-calls` — now redirect to `/mctb` when Voice hidden (OK); confirm canonical `/mctb/*` links in emails/docs.
4. AI lead recovery (`/mctb/ai-recovery`) visible but not certified on live SMS runbook.
5. `npm run test:v1-production-readiness` — run in staging CI; treat FAIL rows as P1 until green.
6. Appointments/booking routes under `/mctb/*` — confuse MCTB-only positioning if linked from nav.

---

## P2 — explicitly wait

- Page-spec visual parity / Kimi Mode 4 completeness  
- Voicemail AI summary polish  
- Analytics drilldown perfection  
- Smart Routing, mass SMS, Fax launch surfaces  
- Exclusions polish, link tracking, booking-link upsell  
- Voice upsell / product switcher  
- Any new feature not on the core journey table  

---

## Tests you can run without PSTN

```bash
npx tsx scripts/test-launch-product-availability.ts
npx tsx scripts/test-mctb-nav-ia.ts
npx tsx scripts/test-mctb-final-pipeline-contract.ts
npx tsx scripts/test-mctb-consent-modes.ts
npx tsx scripts/test-mctb-platform-sender-combined-cert.ts   # needs DB
npm run verify:mctb-final-pipeline
npm run test:v1-production-readiness                           # orchestration
```

---

## Manual production checklist (minimum)

One workspace, one business line, one real phone:

- [ ] Signup → `/mctb` → start setup  
- [ ] CFNA on, verification passes with evidence  
- [ ] `press_1`: unanswered call → press 1 → two SMS bubbles worth of behavior → reply → STOP  
- [ ] Optional: `existing_consent` path on second workspace  
- [ ] Missed call appears on `/mctb/missed-calls` with correct recovery state  

Use `docs/MCTB-AI-LEAD-RECOVERY-LIVE-MANUAL-TEST-RUNBOOK.md` only if AI recovery is in the launch offer.

---

## MCTB_LAUNCH_STATE

**NOT_READY** until P0 live smokes pass — not because UI is missing, because **the money path is unproven on production telephony/SMS**.
