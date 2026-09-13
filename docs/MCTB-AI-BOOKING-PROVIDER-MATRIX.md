# MCTB AI Booking — provider matrix

**AI Booking supported** = configuration + **check availability** + **create booking** all work for the workspace. Reading a calendar alone is insufficient.

## Four operations

| Operation | Product meaning |
|-----------|-----------------|
| **Get booking/calendar configuration** | Event type / service, duration, timezone, buffers |
| **Check availability** | Given a time window, return **actual** open slots |
| **Create booking/event** | Customer chose a returned slot → write to provider |
| **Return confirmed result** | Provider booking/event id, start/end, invite/status |

## Provider matrix

| Provider | Connected? | Read calendar | Check availability | Create booking/event | Send invite | Event type support | Fallback link | AI Booking |
|----------|------------|---------------|--------------------|----------------------|-------------|-------------------|---------------|------------|
| **Microsoft 365** | `voiceCalendarConnection` + OAuth tokens | **Verify** — `hasOAuthTokens` + connection row | **Verify** — `getAvailability` (busy + free slots) | **Verify** — `bookAppointment` + `insertMicrosoftEvent` | **Verify** — when write calendar configured | Via `VoiceService` name / calendar selection | **Yes** — `MctbBookingLink` | **Only if all three** |
| **Calendly** | `integrationConnection` calendly | **Yes** — user/event metadata via API | **Yes** — `listEventTypeAvailableTimes` | **Yes** — `bookEventInvitee` (paid plan + write scopes) | Calendly invitee flow | Event type URI required | **Yes** | **Only if connected + write path works** |
| **Zoho** | CRM OAuth (`zoho`) | **No** — no calendar adapter in repo | **No** | **No** | N/A | N/A | Booking link only | **No** (inspect before enabling) |
| **Google Calendar** | Full scheduler | Yes in shared lib | Yes in `getAvailability` | Yes in appointments stack | Yes | Service-based | Link only in MCTB v1 | **Not in MCTB AI v1** (adapter not registered) |

Mechanical audit entrypoint: `auditMctbAiBookingProvider(workspaceId, provider)` in `src/lib/mctb/ai-booking/capabilities.ts`.

## Runtime fallback chain

```
Scheduling intent
  → AI Booking enabled?
  → provider connected/healthy?
  → capabilities.aiBookingSupported?
  → findAvailableTimes (provider)
  → offer returned slots / specific-time answer
  → createBooking (chosen returned slot)
  → confirm after provider success
ANY failure → fallback booking link URL
```

## Code map

| Layer | Path |
|-------|------|
| Service | `src/lib/mctb/ai-booking/service.ts` |
| Orchestrator | `src/lib/mctb/ai-booking/orchestrator.ts` |
| Adapters | `src/lib/mctb/ai-booking/providers/*.ts` |
| API | `src/app/api/mctb/ai-booking/route.ts` |
| Booking links (separate feature) | `src/lib/mctb/booking-links/*` |

## Tests

- `scripts/test-mctb-ai-booking-service.ts`
- `scripts/test-mctb-booking-simplification.ts`
