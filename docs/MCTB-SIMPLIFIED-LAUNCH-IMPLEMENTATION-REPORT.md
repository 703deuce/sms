# MCTB Simplified Launch — Implementation Report (Pass 1 + Pass 2)

**Status:** Source complete for simplified launch scope — **do not merge/deploy** until product review.

| | |
|--|--|
| Baseline master (PR #483) | `40b49edbcdad8b13d470b65546ab31650d9bc90e` |
| Branch | `cursor/mctb-simplified-launch-2304` |
| Draft PR | #484 |

---

## Protected (unchanged)

PR #483 Call Handling, canonical ingress, Voice V3 PSTN binding, frozen MCTB TeXML, eligibility/dispatch, consent pipeline, **outbound SMS sender routing**.

**PLATFORM/CUSTOMER sender mode:** NOT implemented (`docs/MCTB-EXPLICIT-SMS-SENDER-MODE-LAUNCH-ITEM.md`).

---

## Pass 2 deliverables

### Recovery goal (onboarding + Setup)

- Authoritative: `workspace.customFieldsConfig.mctb.recoveryGoal` + `applyMctbRecoveryGoalConfiguration` → `initial_message` + `request_form_fields_json`.
- **Setup:** `/mctb/setup/text-back` — `MctbRecoveryGoalSetupSection` (same as onboarding).
- **API:** `GET/POST /api/mctb/setup` includes `recoveryGoal`.

### Goal-driven messaging UX

- Launch UI is goal + template preview; optional **Advanced: customize opener** (preserves `messageTemplate` backend).
- Documented limitation: full PLATFORM template lock awaits sender-mode task.

### Request form presets

- `MCTB_RECOVERY_GOALS[].requestFormPreset` on Links setup + goal apply on onboarding/setup.

### Try It removed from customer surfaces

- Nav/demo CTA gated (`MCTB_LAUNCH_TRY_IT_ENABLED`).
- `/mctb/setup/test` — no `/api/mctb/try-it`; setup test + live forward test only.

### Notifications (email launch)

- Workspace event matrix: **email column only** (SMS/in-app hidden).
- Per-recipient **email event** checkboxes → `eventChannelsJson`.
- Runtime: `recipient-event-routing.ts` + launch suppresses SMS/in-app.

### AI replies ↔ Lead Recovery

- **UI:** Notifications → **AI replies** toggle.
- **API:** `POST /api/mctb/handoff` `action: set_launch_ai_replies`.
- **Runtime:** `applyLaunchAiRepliesSetting` → `leadRecovery.enabled` + `SEND_BOOKING_LINK` policies (no `AI_BOOK` in launch action set).

### Legacy `/numbers/.../call-handling`

- `CallHandlingModePanel` read-only redirect to MCTB Overview — no second switch.

### Recovery setup simplification

- Hidden: max attempts row, AI_BOOK section, misleading follow-up link, full AI Lead Recovery nav (pointer to Notifications).

### Duplicate-setting authority

- `src/lib/mctb/setup-field-authority.ts` — authoritative fields documented for audit pairs.

### Voicemail onboarding

- Platform default vs customize (`MctbVoicemailSetupSection`); default does not activate custom greeting (state-only `mark_voicemail_configured`).

---

## Onboarding flow (final)

1. Business line  
2. Connect calls  
3. Consent  
4. Recovery goal (template-driven)  
5. Voicemail (default or studio paths)  
6. Review & real test  

No Try It, no AI Receptionist config, no team SMS/in-app setup.

---

## Message editing after this pass

| Surface | Customer can edit |
|---------|-------------------|
| Recovery goal | Yes (4 options) |
| Opener text | Advanced disclosure only (optional custom `messageTemplate`) |
| PLATFORM enforcement | **No** (deferred) |

---

## Automated tests

All Pass 1 suite **PASS** + `test-mctb-simplified-launch.ts` (expanded).

`npm run verify:mctb-final-pipeline`: **environment failure** (reference DID on AI Direct app) — same class as PR #483; not treated as source regression.

---

## Zero-loss

No changes to Call Handling routing, Voice V3 internals, TeXML pipeline, or SMS send pipeline.

---

## Remaining (post-merge / external)

- Live PSTN certification (Call Handling A–H on deployed SHA).
- PLATFORM/CUSTOMER SMS sender mode (next task).
- Optional: stricter recipient event defaulting for brand-new workspaces (empty `eventChannels` still defaults to email-on for compat).
