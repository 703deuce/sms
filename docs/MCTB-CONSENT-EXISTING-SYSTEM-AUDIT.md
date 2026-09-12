# MCTB Consent — existing system audit

Date: 2026-09-12. Scope: canonical `/mctb/setup/consent` and runtime consent behavior.

## Canonical storage

| Concern | Location |
|--------|----------|
| Consent mode | `workspace.customFieldsConfig.mctb.consentMode` and solution setup meta; values `press_1` \| `existing_consent` |
| Existing consent attestation | `workspace.customFieldsConfig.mctb.existingConsentAttestation` (`accepted`, `attestedAt`, `attestedByUserId`, `version`) |
| Press 1 prompt | Consent prompt store + `/api/mctb/consent-prompt` |
| Per-call Press 1 evidence | Consent log / capture pipeline (not duplicated on Setup page) |

Types and labels: `src/lib/mctb/consent-mode.ts`.

## APIs

| Method | Path | Role |
|--------|------|------|
| GET | `/api/mctb/setup` | `consentMode`, `consentMeta.existingConsentEligible`, `consentMeta.existingConsentAttestation`, compliance.messagingReady, phone numbers |
| POST | `/api/mctb/setup` | `consentMode`, `existingConsentAttested` (required when switching to existing_consent); rejects ineligible existing_consent; records attestation; syncs consent routing + TeXML handler mode |
| GET | `/api/mctb/consent-prompt` | Disclosure script + playback URL for Press 1 preview |

## Eligibility (existing consent)

- UI gate: `isExistingConsentModeEligible({ messagingReady })` in `src/lib/mctb/setup-consent-eligibility.ts` — same signal as Setup Overview `existingConsentBlocked` inverse (`isMctbSetupMessagingReady`).
- Server gate: `POST /api/mctb/setup` when `consentMode === "existing_consent"` re-loads phone/compliance and returns 400 if not messaging-ready.

## Runtime — Press 1

1. Inbound call hits MCTB TeXML ingress (`mctb-entry`).
2. `resolveMctbTexmlHandlerMode`: `press_1` when consent mode is `press_1` and automation active; otherwise voicemail branch.
3. Gather / disclosure / DTMF 1 → consent event persisted; recovery SMS eligibility enforced downstream (not via existing-consent capture path).
4. No Press 1 / wrong DTMF → no per-call consent; recovery SMS under Press 1 mode does not proceed on consent basis.

## Runtime — existing consent

1. `resolveMctbTexmlHandlerMode` returns `voicemail` (no Press 1 gather on call).
2. `evaluateMctbRecoveryEligibility` in `src/lib/mctb/capture/eligibility.ts`: only when mode is `existing_consent`, validates attestation via `validateExistingConsentAttestation`, then continues with standard MCTB eligibility.
3. Press 1 mode short-circuits this path with `NOT_EXISTING_CONSENT` — per-call consent is handled on the voice path, not capture eligibility.

## UI (this pass)

- Page: `src/components/mctb/setup/setup-consent-view.tsx` + `mctb-setup-consent.css`
- Reuses Setup shell horizontal nav; no second vertical sidebar.
- Consent log drill-down: `MCTB_ROUTES.complianceConsent` (`/mctb/compliance/consent`).

## Non-goals (preserved)

- No duplicate consent model or parallel SMS eligibility engine.
- Consent log remains a separate compliance page.
