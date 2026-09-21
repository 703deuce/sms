# Google Calendar — date/time provider boundary (Voice V3)

**Status:** Permanent architecture addendum for Google Calendar scheduling.  
**Applies with:** `docs/GOOGLE-CALENDAR-VOICE-V3-IMPLEMENTATION-DIRECTIVE.md`, `docs/GOOGLE-CALENDAR-INTEGRATION-ENGINEERING-GUIDE.md`

## Invariant (locked)

```
Caller natural language
  → set_scheduling_preference + scheduling-normalizer (Voice V3)
  → Transovo canonical scheduling (NormalizedSchedulingPreference + UTC slot instants)
  → deterministic scheduling engine (slots, revalidation, booking request)
  → provider serializer (Microsoft FROZEN | Google NEW)
  → provider API
  → provider response normalizer
  → Transovo canonical intervals (UTC)
  → scheduling engine
```

**NEVER:** Google ← Microsoft-formatted date/time payloads.  
**NEVER:** Google ← unresolved caller language (`tomorrow`, `next Wednesday`, `around 2`, …).

## Audit map (Microsoft reference — do not change)

| Step | Location |
|------|----------|
| Caller-relative normalization | `src/lib/voice-v3/time/scheduling-normalizer.ts` (`normalizeSchedulingMeaning`) |
| Canonical preference | `src/lib/voice-v3/time/scheduling-types.ts` (`NormalizedSchedulingPreference`) |
| Business timezone | `VoiceV3CallContext.business.timezone` / `config.timezone` |
| Duration / slots | `src/lib/voice-v3/calendar/slot-generator.ts`, `build-create-booking-request.ts` |
| Microsoft → Graph wire | `src/lib/voice/calendar/providers.ts` (`insertMicrosoftEvent`) + `microsoft/microsoft-graph-datetime-timezone.ts`, `microsoft-time-adapter.ts` |
| DST | `src/lib/voice-v3/time/timezone.ts` (`wallTimeInZoneToUtc`, `zonedDateParts`) — IANA only, no fixed offsets |
| Availability window (internal) | `FindAvailabilityRequest.rangeStartUtc` / `rangeEndUtc` (UTC instants) |
| Microsoft busy → canonical | `microsoft-find-availability.ts` → `CalendarBusyInterval` (`startUtc`/`endUtc`) |

## Google attachment points

| Step | Location |
|------|----------|
| Canonical → Google timed event | `src/lib/voice-v3/calendar/google/google-datetime-adapter.ts` (`canonicalUtcIntervalToGoogleTimedEventBounds`) |
| events.list window | `google-events-api.ts` — `timeMin`/`timeMax` as `Date.toISOString()` (UTC RFC3339) + `timeZone` query param |
| Google event → canonical busy | `google-event-interval-normalizer.ts` (`normalizeGoogleEventToBusyInterval`) — **timed + all-day** (exclusive end date) |
| Book / reschedule | `google-create-booking.ts`, `google-update-booking.ts` — adapter only, not raw `startUtc` Z strings as `dateTime` |

## Google wire rules

**Timed appointment (create/update):**

```json
{
  "start": { "dateTime": "2026-09-23T14:00:00", "timeZone": "America/New_York" },
  "end":   { "dateTime": "2026-09-23T15:00:00", "timeZone": "America/New_York" }
}
```

Wall `dateTime` + IANA `timeZone` — offsets are **not** hand-authored (`UTC-4` forbidden).

**All-day (read for availability only):**

```json
{ "start": { "date": "2026-09-23" }, "end": { "date": "2026-09-24" } }
```

`end.date` is **exclusive**.

## Round-trip certification

For each operation: canonical business-local time → Google serialize → parse response → canonical UTC/local must match intended appointment (not shifted by 1h on DST boundaries).

**Tests:** `scripts/test-google-calendar-datetime-adapter.ts`

## DST certification zones (minimum)

`America/New_York`, `America/Chicago`, `America/Denver`, `America/Los_Angeles` — include dates on both sides of US DST transitions.
