# MCTB Phone & Forwarding — existing system audit

## Route

| Item | Value |
|------|--------|
| Canonical route | `/mctb/setup/phone` (`MCTB_ROUTES.setupPhone`) |
| Page entry | `src/app/(app)/mctb/setup/phone/page.tsx` |
| View (post pass) | `src/components/mctb/setup/setup-phone-forwarding-view.tsx` (exported as `MctbSetupPhoneView`) |

## Shell

- Global MCTB sidebar + app bar via `app-shell.tsx` (`isMctbSetupFullWidthRoute`).
- Setup horizontal nav: `MctbSetupShell` + `MctbSetupSectionNav` (`setup-sections.ts`, section `phone`).

## Data sources (read)

| Concern | API / module |
|---------|----------------|
| Runtime MCTB number, business line, phone list, messaging readiness, pause | `GET /api/mctb/setup` → `loadMissedCallTextConfig`, workspace `customFieldsConfig.mctb`, `loadMctbOnboardingState` |
| Carrier, ring seconds, forwarding verification | `GET /api/mctb/onboarding` → `loadMctbOnboardingState`, `getForwardingVerificationStatus` |
| Carrier instruction copy | `MCTB_CARRIER_GUIDES` / `formatCarrierStep` (`src/lib/mctb/onboarding/carriers.ts`) |
| Dial codes / capabilities | `carrier-capabilities.ts` |
| Forward target E.164 | Selected `phoneNumberId` from setup list, else `productionForwardTargetE164` from setup payload |

## Persistence (write)

| User action | API | Fields |
|-------------|-----|--------|
| Save changes | `POST /api/mctb/setup` | `phoneNumberId`, `businessLineE164`, `activate: false` |
| Carrier, business number, ring | `POST /api/mctb/onboarding` | `forwardingCarrier`, `businessNumberE164`, `forwardingRingSeconds` (requires `completedSteps` includes `demo`) |
| Start forwarding test | `POST /api/mctb/onboarding` | `{ action: "start_forwarding_test" }` → `startForwardingVerificationTest` |
| Verification poll | `GET /api/mctb/onboarding` | `forwardingVerification` from `getForwardingVerificationStatus` |

## Verification logic

- `src/lib/mctb/onboarding/forwarding-verification.ts`
- Test window: `forwardingTestStartedAt`; success sets `forwardingConnectedAt` when forwarded call metadata matches business line.
- UI does **not** self-attest verification (`forwardingConnected` deprecated).

## Related routes

| Link | Target |
|------|--------|
| Manage numbers | `MCTB_ROUTES.numbers` (`/mctb/numbers`) |
| Troubleshooting | `MCTB_ROUTES.setupTest` (`/mctb/setup/test`) |

## Legacy UI (preserved for wizard)

- `MctbPhoneForwardingPanel` remains used by onboarding wizard; setup page no longer embeds inline instruction wall.

## Phone validation

- Client: `setup-phone-forwarding-model.ts` (US 10/11 digit plausibility).
- Server: onboarding `startForwardingVerificationTest` uses `normalizeE164`; setup route persists trimmed business line.
