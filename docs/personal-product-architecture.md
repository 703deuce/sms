# Transovo Personal — product architecture

Personal is a **number-management** product: own, preserve, and control phone numbers while the user's existing mobile remains the endpoint. It is not a softphone replacement.

## Competitor lane

NumberBarn, Nomo Home Phone, VoIPly parking, Unitel, RingBoost — plus 800.com as the ceiling for analytics. Personal matches that lane and stays below business phone-system features (IVR, CRM, AI receptionist, SMS, etc.).

## Routes

| Route | Purpose |
|-------|---------|
| `/personal` | Overview |
| `/personal/numbers` | All owned numbers |
| `/personal/numbers/[id]` | Number hub (status, usage, port-out, quick actions) |
| `/personal/numbers/premium` | Find / buy numbers |
| `/personal/porting` | Port in + port out |
| `/personal/forwarding` | Forwarding, schedules, screening, caller ID |
| `/personal/voicemail` | Greeting + inbox |
| `/personal/vault` | Vaulted numbers + incoming handling |
| `/personal/activity` | Call activity log |
| `/personal/analytics` | Volume, trends, per-number breakdown |
| `/personal/blocked` | Blocked callers |
| `/personal/usage` | Forwarding minutes + billing period |
| `/settings/billing` | Billing (shared) |

## Number-scoped UX

Every feature page uses `PersonalNumberSelector` with `?numberId=` query param. Aggregate views (analytics all-numbers) omit the filter or offer "All numbers".

## Lifecycle states (one per number)

`ACTIVE` | `VAULTED` (`PARKED` / `PARKED_VOICEMAIL`) | `PORTING_IN` | `PORTING_OUT` | `PORT_AWAY_WINDOW` | `SUSPENDED` | `CANCEL_PENDING` | `ACTION_REQUIRED`

Stored in `PhoneNumber.settingsJson.personalServiceState` and derived from forwarding/vault/port flags.

## Settings storage (`PhoneNumber.settingsJson`)

Personal call settings live in `personal-call-settings.ts`:

- `incomingCallHandling`: `forward` | `voicemail_only` | `announcement_only`
- `vaultIncomingMode`: `silent` | `parked_message` | `voicemail`
- `forwardMode`: `single` | `sequential` | `simultaneous`
- `forwardTargets`: E.164 array (max 5); `voiceForwardTo` = primary/first target
- Ring seconds, unanswered/busy/failed fallbacks
- `callerIdDisplay`: `original` | `transovo_number`
- `callScreeningEnabled`
- `forwardSchedule` JSON (always | custom windows)
- Announcement text/URL for announcement-only mode
- Port-out: `portOutAccountNumber`, `portOutPin`, `portOutLocked`

Voicemail per-number secondary email: `voicemailSecondaryEmail` in settingsJson.

## Port in UX labels

Backend `PortRequest.status` maps to customer labels:

| Backend | Customer label |
|---------|----------------|
| `pending` | Preparing |
| `docs_needed` | Action Required |
| `submitted` | Submitted |
| `in_progress` | Carrier Review |
| `foc_confirmed` | Scheduled |
| `completed` | Completed |
| `rejected` | Action Required |
| `cancelled` | Cancelled |

**Never tell users to cancel old service until port completes.**

## Telephony routing

`resolveNumberInboundRoute()` in `inbound-number-routing.ts` runs before softphone rules:

1. Vault → silent / message / voicemail
2. Announcement-only → speak + hangup
3. Forward → `forwardPersonalWithRing` (hunt for multi-target)
4. Voicemail-only / direct voicemail
5. Unavailable message

Blocked callers (`Suppression` with `p:+E164`) terminate before routing.

## Phases

- **P0 (this build):** Settings schema, UI surfaces, activity/analytics/usage/blocked APIs, port-out display, expanded forwarding UI, number hub.
- **P1:** Metered transcription billing integration.
