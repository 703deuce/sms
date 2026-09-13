# MCTB AI Booking — provider matrix

AI Booking is a premium MCTB capability: conversational scheduling using the **connected external provider** as system of record. MCTB does not host calendar UI or appointment inventory.

**Rule:** Never invent availability. If provider APIs fail or disconnect, fall back to configured **booking link**.

| Provider | Connected? | Read availability? | Create booking? | Send invite? | Event type support? | Fallback link? | Status |
|----------|------------|----------------------|-----------------|----------------|---------------------|----------------|--------|
| **Calendly** | Per workspace OAuth (`calendly` integration) | **Yes** — `listEventTypeAvailableTimes` in `src/lib/integrations/adapters/calendly-actions.ts` | **Yes** — `bookEventInvitee`, `bookNextAvailableSlot` (requires write scopes; reconnect if missing) | Via Calendly invitee flow | Event type URI required for slot query | **Yes** — `MctbBookingLink` | Backend capable; MCTB AI runtime UI **not fully wired** (upgrade gate in Setup) |
| **Microsoft 365 / Outlook** | Per workspace calendar connection | **Yes** — `getMicrosoftBusy` / calendar view in `src/lib/calendar/providers.ts`; appointments stack uses same | **Yes** — event creation via existing Graph/calendar write paths used by appointments product | **Yes** — calendar invitations where write calendar configured | Uses selected write calendar / meeting methods | **Yes** | Backend capable; MCTB AI runtime UI **not fully wired** |
| **Google Calendar** | Supported in full scheduler | Yes (busy) in shared calendar lib | Yes in appointments product | Yes | Service/meeting types | Booking link only in MCTB | **MCTB AI Booking: not in v1 matrix** (link-only) |
| **Square / other URLs** | N/A | No | No | No | N/A | **Yes** — booking link only | Link mode only |

## Booking link mode (default)

| Capability | Integration required? |
|------------|---------------------|
| Configure multiple `MctbBookingLink` rows | No |
| Send link in Conversations | No |
| Include `{{link}}` in initial recovery | No (uses `defaultLinkUrl`) |

## Implementation notes

- Reuse existing integrations — do **not** add a second Microsoft Graph client for MCTB.
- Calendly AI path must call real adapter functions; if `bookEventInvitee` returns UNSUPPORTED (plan/scope), respond with fallback link message.
- Store minimal post-booking metadata on conversation activity (provider, external id, start/end, timezone) — not a parallel Transovo appointment engine unless an existing bridge requires it.

## Verification

Mechanical checks: `scripts/test-mctb-booking-simplification.ts` and integration cert scripts under `scripts/certify-appointment-stack-live.ts` for Microsoft write paths.
