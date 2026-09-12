# MCTB Consent — runtime matrix

Derived from code paths in `texml-mode-provision.ts`, `capture/eligibility.ts`, consent TeXML routes, and setup POST sync.

## Press 1 (`press_1`)

| Stage | Behavior |
|-------|----------|
| Inbound call | MCTB TeXML ingress; handler mode `press_1` when automation active |
| Disclosure | Published consent prompt audio/script |
| DTMF | Gather; digit `1` records consent event |
| Consent event | Persisted to consent log / call metadata |
| SMS eligibility | Requires per-call consent evidence; not `evaluateMctbRecoveryEligibility` existing-consent path |
| No input / decline | No Press 1 consent; recovery SMS not authorized under this mode |
| Voicemail | Call continues per routing (gather failure → voicemail/fallback per ingress) |
| Recovery send | Standard recovery engine after consent + other gates |

## Existing consent (`existing_consent`)

| Stage | Behavior |
|-------|----------|
| Inbound call | Handler mode `voicemail` — no Press 1 gather |
| Press 1 prompt | Not used |
| Attestation | `validateExistingConsentAttestation` must pass |
| Sender eligibility | `isMctbSetupMessagingReady` required at setup save and product gates |
| SMS eligibility | `evaluateMctbRecoveryEligibility` when mode is existing_consent |
| Voicemail | Part of call path while mode skips Press 1 |
| Recovery send | After attestation + messaging/compliance + trigger rules |
| Missed call alone | Does **not** create consent |

## Mode change (setup save)

- POST updates `consentMode`, records attestation when selecting existing consent.
- `syncMctbConsentRouting` + `provisionMctbPhoneTexmlIngressModeForWorkspace` refresh voice URL handler branch.
- UI must not save ineligible `existing_consent` (server enforces).
