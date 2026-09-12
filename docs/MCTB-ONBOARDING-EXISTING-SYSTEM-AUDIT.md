# MCTB onboarding — existing system audit

Mechanical inventory before the six-step wizard redesign (2026-03). Canonical route: **`/onboarding/mctb`**.

## Routes

| Route | Behavior |
|-------|----------|
| `/onboarding/mctb` | `MctbOnboardingWizard` — first-time activation |
| `/mctb/setup/start` | Redirect → `/onboarding/mctb` |
| Middleware | Incomplete onboarding may redirect new MCTB users here |
| Completion | `isOnboardingComplete` → `trialActivatedAt` or `currentStep` `ready`/`complete` |

## State persistence

| Store | Fields |
|-------|--------|
| `workspace.customFieldsConfig.mctbOnboarding` | `MctbOnboardingState` (version 2) |
| Workspace row | `name`, `displayName`, `customFieldsConfig.mctb.consentMode` |
| MCTB config | `updateMissedCallTextConfig` (`initial_message`) |
| Phone / TFV | Trial number provisioning, TFV records via `/api/mctb/tfv` |

Resume: `currentStep`, `completedSteps`, and field values reload on GET `/api/mctb/onboarding`.

## Legacy wizard steps (pre-redesign UI order)

| Step ID | Label | Capabilities |
|---------|-------|----------------|
| `business` | Business info | Name, website → workspace name |
| `consent` | Consent method | `press_1` / `existing_consent`, attestation, `syncMctbConsentRouting` |
| `demo` | See how it works | `start_demo` → `startMctbTryItSession` (onboarding context) |
| `trial_number` | Your Transovo number | `provision_trial_number` |
| `configure` | Text-back message | `messageTemplate` → MCTB config |
| `tfv` / `pending` | Toll-free / A2P | POST `/api/mctb/tfv`, poll status |
| `connect` | Connect business line | Carrier, business E.164, ring seconds, `start_forwarding_test`, verification |
| `live_test` | Live test | `/api/mctb/live-test`, auto `activateMctbTrial` on pass |
| `complete` | Trial active | Redirect to MCTB home |

## APIs (unchanged engine)

| Endpoint | Role |
|----------|------|
| `GET/POST /api/mctb/onboarding` | Wizard state + actions |
| `POST /api/mctb/tfv` | Messaging verification submit |
| `GET/POST /api/mctb/live-test` | Canonical live test (same as Setup → Test) |
| `GET/POST /api/mctb/setup` | Consent eligibility meta for existing-consent gate |
| `GET/POST /api/phone/voicemail` | Voicemail greeting (Setup Voicemail; onboarding step uses default + link) |

## Runtime gates (preserved)

- Forwarding verification via Twilio proof (`start_forwarding_test`)
- Existing consent requires attestation + server eligibility
- Trial activation: `evaluateTrialActivationGates` (number, TFV/A2P, forwarding, live test)
- Production ingress: `isProductionActivationPhase` in `ingress.ts` (updated for new step ids + legacy completed steps)

## New six-step UI mapping

| UI stage | Primary legacy capabilities merged |
|----------|-----------------------------------|
| Business line | `business` + business phone/carrier capture |
| Connect calls | `connect` + auto number assign for forward target |
| Consent | `consent` |
| Recovery | `trial_number`, `configure`, `tfv`, `pending` + demo modal |
| Voicemail | Canonical voicemail path (default greeting; full studio in Setup) |
| Review & test | `live_test` + readiness summary |
| Ready | `complete` + `activate_trial` |

## Async / blocked states

- TFV: `not_started` → `submitted` / `in_review` → `approved` / `action_required` / `rejected`
- Forwarding: listening / verified / failed (polling)
- Live test: timeline checkpoints; failure does not erase saved setup

## Not duplicated

- No second onboarding store
- No parallel TFV or live-test implementation
- Setup pages read the same workspace/MCTB config written here
