# Voice V3 — Microsoft FIND availability (no BOOK)

## Flow

```
CallerMeaning → VoiceV3CallContext → scheduling normalizer
→ evaluateVoiceV3Rules() → requiredAction FIND_AVAILABILITY
→ dispatchFindAvailabilityIfRequired (async)
→ Microsoft Graph busy intervals
→ generateAvailabilitySlots (business hours ∩ free time ∩ duration)
→ AvailabilityOfferSet in CallContext
→ session.thinking.append (authoritative slots for GPT-Live) → response.create (speak continuation)
```

Astra and GPT-Live do **not** decide when FIND runs.

## Graph endpoint

Primary path (when connection + SMTP available):  
`POST /v1.0/me/calendar/getSchedule` via `getMicrosoftBusy()` in `@/lib/voice/calendar/providers`.

Fallback: `GET /v1.0/me/calendar/calendarView` for explicit `calendarId`.

## Reused from V2 (transport only)

- `@/lib/voice/calendar/providers` — `getMicrosoftBusy`, `getValidAccessToken`, `hasOAuthTokens`
- `src/lib/voice-v2/pipelines/microsoft-365-certified/internal/graph-datetime-timezone.ts` — Graph timezone adapter (via `microsoft-time-adapter.ts`)

Not reused: V2 workflow stages, tool gates, offer-set store, FIND orchestrator.

## V3 files

| Path | Role |
|------|------|
| `src/lib/voice-v3/calendar/types.ts` | FIND request, busy intervals, failures |
| `src/lib/voice-v3/calendar/find-availability.ts` | Request builder + dispatch dedupe key |
| `src/lib/voice-v3/calendar/slot-generator.ts` | Deterministic slot generation |
| `src/lib/voice-v3/calendar/offer-set.ts` | Canonical `AvailabilityOfferSet` |
| `src/lib/voice-v3/calendar/find-dispatch.ts` | Async dispatch, stale generation guard |
| `src/lib/voice-v3/calendar/live-availability-context.ts` | `session.thinking.append` payload |
| `src/lib/voice-v3/calendar/microsoft/microsoft-find-availability.ts` | Graph busy fetch |
| `src/lib/voice-v3/calendar/microsoft/microsoft-time-adapter.ts` | IANA ↔ Graph boundary |

## OfferSet shape

```ts
interface AvailabilityOfferSet {
  offerSetId: string;
  schedulingGeneration: number;
  createdAt: string;
  timezone: string;
  slots: Array<{
    slotId: string; // slot_1, slot_2, …
    startUtc: string;
    endUtc: string;
    localStart: string;
    localEnd: string;
  }>;
}
```

## Stale results

`applyFindAvailabilityResult` and in-flight completion compare `result.schedulingGeneration` to `ctx.scheduling.generation`. Older results log `AVAILABILITY_RESULT_STALE` and do not mutate offer set.

## Tests

```bash
npm run test:voice-v3-availability
```

Real Graph integration: set `VOICE_V3_TEST_MICROSOFT_CONNECTION_ID`, `VOICE_V3_TEST_CALENDAR_ID`, `DATABASE_URL`, `OPENAI_API_KEY` (not required for FIND-only script) and run a dedicated integration script when added.

## PSTN smoke (operator)

After deploy: say “next Friday afternoon” → verify logs  
`FIND_AVAILABILITY_REQUIRED` → `FIND_AVAILABILITY_DISPATCHED` → `MICROSOFT_AVAILABILITY_*` → `AVAILABILITY_OFFER_SET_CREATED` → `LIVE_AVAILABILITY_CONTEXT_SENT` → Amy offers only listed slots.

Change request mid-flight → only latest `scheduling_generation` offer set survives.
