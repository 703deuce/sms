# MCTB full-app audit — settings, persistence, tenant isolation, standards

**Date:** 2026-10-02  
**Baseline:** `77107ec5` + wizard terminal fix (`53837cd7`)  
**Scope:** Missed Call Text Back — backend save paths, tenant boundaries, Transovo security/IA rules (automated + code review). Not a repeat of browser/590 matrix or PSTN certification.

---

## Summary

| Area | Result |
|------|--------|
| **MCTB API auth / workspace scoping** | **PASS** — all `src/app/api/mctb/**` routes use session + `getActiveWorkspaceId()` or `requireSession()`; no `body.workspaceId` overrides found. |
| **Settings persist to backend** | **PASS** (contract tests) — setup sections (phone, recovery, exclusions, notifications, links, sender mode, consent model) have dedicated persistence scripts; all **PASS** in commercial guards. |
| **Tenant isolation** | **PASS** — platform inbound isolation test + new API isolation test (missed-call detail + booking links). |
| **Existing Consent on Free** | **PASS** (runtime on master) — **not** paid-gated; attestation still required. Stale **test** expectations were wrong and are **fixed** in this pass. |
| **Transovo standards (automated)** | **PASS** — stage-2 presentation, legacy import boundaries, commercial guards; consolidated matrix **61/61** after onboarding `complete` step alignment. |

---

## Pages inventoried (customer MCTB)

Operational: Overview, Missed Calls (+ detail), Conversations, Voicemail, Analytics.  
Setup: overview, phone, missed-call rules, text-back, consent, recovery, voicemail, exclusions, notifications, links, test, wizard start.  
Other: numbers, compliance consent log, onboarding, public request form `/f/mctb/[token]`.  
Legacy redirects: business-hours, follow-up → recovery (per manifest).

Each setup area maps to **`POST /api/mctb/setup`**, **`/api/mctb/handoff`**, **`/api/mctb/exclusions`**, **`/api/mctb/consent-prompt`**, **`/api/mctb/onboarding`**, or section-specific APIs — all workspace-scoped.

---

## Security & tenant (Guide #9)

- **Workspace ID:** Derived from session (`getActiveWorkspaceId`), not client-supplied on MCTB JSON APIs.
- **Object access:** Missed-call detail uses `findFirst({ id, workspaceId })` → 404 cross-tenant.
- **Booking links:** create/update/delete scoped by `workspaceId` in service layer.
- **Admin bootstrap:** `POST /api/mctb/admin-test/bootstrap` requires `session.isAdmin`.
- **Cross-tenant override:** `resolveWorkspaceId()` in `api-auth.ts` only allows override when user is a **member** of requested workspace.

**New regression:** `scripts/test-mctb-api-workspace-isolation.ts` (wired into `run-mctb-commercial-launch-guards.sh`).

---

## Settings save / backend truth

| Surface | API / lib | Persistence test |
|---------|-----------|------------------|
| Setup core (pause, triggers, template, consent mode) | `POST /api/mctb/setup` | setup-recovery, setup-consent, setup-sender-mode-persist |
| Phone & forwarding | setup + provisioning libs | setup-phone-forwarding, phone-validation |
| Exclusions | `/api/mctb/exclusions` | test-mctb-setup-exclusions |
| Notifications / handoff | `/api/mctb/handoff` | test-mctb-setup-notifications, handoff recipient contracts |
| Booking links | `/api/mctb/booking-links` | test-mctb-setup-links |
| Consent prompt audio | `/api/mctb/consent-prompt` | existing-consent-attestation, texml route tests |
| Onboarding | `/api/mctb/onboarding` | onboarding-entry-path, business-line-persist |
| AI Recovery config | `/api/mctb/lead-recovery/config` | ai-recovery-entitlement-gate (+ simulate gated on `ac3651b6`) |

**Known UI caveat (production browser cert, not backend):** notifications recipient row readback was fixed on `e545faa7` client wiring; retest on deployed SHA after deploy if UI still fails in harness.

---

## Consent & commercial (product truth on master)

- **Free:** 10 recoveries/month; **Press-1 and Existing Consent** (with attestation/certification).
- **Text Back:** 50/month; **AI Recovery:** 100/month.
- Consent mode does **not** change monthly allowance (single `reserveMctbRecoveryUnit` counter).

---

## Bugs fixed in this pass

1. **Stale tests implied paid-only Existing Consent** while `setup-consent-eligibility.ts` on master correctly allows Free + platform sender / messaging ready. Tests `test-mctb-setup-consent.ts` and `test-mctb-setup-sections.ts` updated to match product + implementation.

2. **Onboarding wizard test drift** — `normalizeOnboardingStep("complete")` returns `complete` (post–trial activation). Test expected legacy `ready`; `isWizardTerminalStep` / `inferResumeStep` / `wizardStageIndex` now treat `complete` as terminal alongside `ready`.

---

## Remaining gaps (not fixed in this pass)

| Item | Type |
|------|------|
| Full manual browser walk of every page | Human QA |
| Physical PSTN / carrier approval | External |
| Production notifications harness rows (historical cert docs) | Re-verify on current deploy |
| `provision_telnyx_local` | Auth-only; no per-workspace rate limit (post-launch hardening) |
| Live-test POST | Session-only; low cost |

---

## Commands run

```bash
bash scripts/run-mctb-commercial-launch-guards.sh   # PASS (includes new isolation test)
# Setup section scripts: recovery, sender, exclusions, notifications, links, phone — all PASS
```

---

## Standards alignment (high level)

- **IA (#3):** Routes under `/mctb/*` per manifest; no duplicate nav engines audited in this pass.
- **Privacy/consent (#8):** Press-1 vs existing_consent paths preserved; attestation server-side in `capture/attestation.ts`.
- **Forms (#5):** APIs validate consent attestation and setup payloads server-side (existing tests).
- **Accessibility / visual:** Stage-2 presentation verifier PASS; no per-page manual a11y pass in this run.
