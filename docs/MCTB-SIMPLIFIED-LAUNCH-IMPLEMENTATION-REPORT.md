# MCTB Simplified Launch — Implementation Report (pass 1)

**Status:** In progress — **do not merge/deploy** until reviewed and remaining gaps closed.

**Baseline master SHA (PR #483 merged):** `40b49edbcdad8b13d470b65546ab31650d9bc90e`  
**Branch:** `cursor/mctb-simplified-launch-2304`  
**PR #483 at baseline:** Yes (Call Handling on master)

---

## Call Handling (protected — not reimplemented)

- Uses existing `src/lib/call-handling/*` + `/api/call-handling` + `call-handling-switcher.tsx`.
- No `mctbInbound` ownership revert; static tests assert canonical ingress resolver remains.
- Voice V3 PSTN deterministic bind (`resolve-pstn-wizard-binding.ts`) unchanged in this pass.

---

## What this pass implemented

| Area | Change |
|------|--------|
| **Launch flags** | `src/lib/mctb/launch-flags.ts` — Try It off, email-only notifications, hide AI_BOOK UI, simplify recovery UI |
| **Try It** | `shouldShowTryItNav` respects launch flag (admin-only); onboarding demo CTA hidden |
| **Recovery goals** | `recovery-goals.ts`, `apply-recovery-goal-config.ts`, onboarding goal cards + API `recoveryGoal` |
| **Voicemail onboarding** | `OnboardingVoicemailStep` — platform default vs embed `MctbVoicemailSetupSection` |
| **Notifications runtime** | `recipient-event-routing.ts` + `deliverMctbHandoffNotifications` intersects recipient `eventChannels`; launch suppresses SMS/in-app |
| **Recovery setup UI** | Hide max-attempts row + `MctbSetupBookingSection` when launch flags set |
| **Tests** | `scripts/test-mctb-simplified-launch.ts` |

---

## Not completed in this pass (explicit gaps)

- Setup **Text Back / Recovery** goal selector (setup editors — onboarding only so far).
- **PLATFORM/CUSTOMER** SMS sender mode — **not implemented** (see `docs/MCTB-EXPLICIT-SMS-SENDER-MODE-LAUNCH-ITEM.md`); outbound pipeline untouched.
- **Notifications setup UI** — hide SMS/in-app matrix columns; per-recipient event subscription UI.
- **AI replies launch policy** — wire setup toggle to `leadRecovery.enabled` with SEND_BOOKING_LINK defaults; hide misleading `responseMode` picker.
- **Legacy `/numbers/.../call-handling`** — deprecate/hide second control vs PR #483.
- **Setup-test Try It embed** — gate/hide synthetic demo block on `/mctb/setup/test`.
- **Controlled platform-sender templates** — product copy/variants only after sender mode exists.
- **Duplicate-setting audit** — documented in connectivity audit; no new persistence split.

---

## Onboarding flow (after this pass)

1. Business line  
2. Connect calls / forwarding  
3. Consent  
4. Recovery goal + message (composer)  
5. Voicemail (default or studio paths)  
6. Review & real test  

No Try It step; no AI Receptionist configuration inside MCTB onboarding.

---

## Pause → voicemail

Unchanged runtime: MCTB Call Handling owner + `automationActive` / recovery pause → voicemail, no recovery SMS (existing MCTB path).

---

## PLATFORM / CUSTOMER sender mode

**Status:** Not implemented. Current model remains `resolveMctbOutboundSmsRoute` candidate ordering + authorization. This pass did **not** modify SMS send pipeline.

---

## Automated tests (this branch)

| Command | Result |
|---------|--------|
| `npx tsx scripts/test-mctb-simplified-launch.ts` | **PASS** |
| `npx tsx scripts/test-call-handling-ownership.ts` | **PASS** |
| `npx tsx scripts/test-call-handling-pstn-wizard-binding.ts` | **PASS** |
| `npx tsx scripts/test-mctb-onboarding-wizard-flow.ts` | **PASS** |
| MCTB setup suite (consent, phone, links, notifications, exclusions, recovery, handoff) | **PASS** |
| `test-mctb-final-pipeline-contract.ts` | **PASS** |
| `test-voice-v3-wizard-step7-v3-path.ts` | **PASS** |
| `npm run verify:mctb-final-pipeline` | **Not re-run** — previously classified environmental on reference DID |

---

## Zero-loss (intentional)

No changes to frozen TeXML, eligibility dispatch, Voice V3 internals, or Call Handling routing. Backend Try It APIs preserved; customer nav/demo gated off.

---

## Next steps

1. Complete setup-surface recovery goals, notifications UI, AI reply launch wiring, legacy call-handling hide.  
2. Re-run full regression + update this report.  
3. Merge only after review — **separate from PR #483** (already on master).  
4. Live PSTN certification for Call Handling remains on deployed `40b49edb` per `docs/CALL-HANDLING-FINAL-SOURCE-REGRESSION-REPORT.md`.
