# Voice V3 — Google Calendar adapter implementation report

**Basis:** `docs/VOICE-V3-GOOGLE-CALENDAR-REUSE-AUDIT.md` (approved)  
**Scope:** Connect existing `src/lib/calendar/**` Google stack to current Voice V3 FIND/BOOK/MANAGE — no OAuth rebuild, no legacy `voice/calendar/booking.ts`, no voice worker changes.

---

## 1. Files changed

- `src/lib/solutions/appointment-receptionist/types.ts` — `GOOGLE_CALENDAR` strategy
- `src/lib/voice-receptionist-wizard/booking-strategy.ts` — derive + find/book flags
- `src/lib/voice-v3/calendar/types.ts` — `google` provider + FIND failure reasons
- `src/lib/voice-v3/calendar/booking-types.ts` — Google failure reasons + `ConfirmedBooking.provider`
- `src/lib/voice-v3/calendar/appointment-management-types.ts` — `ExistingAppointment.provider`
- `src/lib/voice-v3/config/compile-voice-v3-agent-config.ts` — Google calendar compile
- `src/lib/voice-v3/config/from-published-agent.ts` — `resolveGoogleProviderConnections`
- `src/lib/voice-v3/tools/authorize-tool-for-config.ts` — direct calendar (MS + Google)
- `src/lib/voice-v3/tools/voice-tool-catalog.ts` — same
- `src/lib/voice-v3/agent/capability-state.ts` — direct calendar capabilities
- `src/lib/voice-v3/calendar/find-dispatch.ts` — `fetchV3ProviderBusyIntervals`
- `src/lib/voice-v3/calendar/book-dispatch.ts` — revalidate + create branches
- `src/lib/voice-v3/calendar/reschedule-dispatch.ts` — busy + update + reconcile
- `src/lib/voice-v3/calendar/cancel-dispatch.ts` — cancel + reconcile
- `src/lib/voice-v3/calendar/find-existing-appointment.ts` — Google discovery
- `src/lib/voice-v3/operations/provider-failure-map.ts` — `google_token` / throttled
- `docs/VOICE-V3-CODE-GAPS-REGISTER.md` — wording (not connected vs not built)

## 2. Files added

- `src/lib/voice-v3/calendar/direct-calendar-strategy.ts`
- `src/lib/voice-v3/calendar/fetch-v3-provider-busy.ts`
- `src/lib/voice-v3/calendar/google-discovery-selection-id.ts`
- `src/lib/voice-v3/config/resolve-google-connection.ts`
- `src/lib/voice-v3/calendar/google/resolve-voice-v3-google-calendar.ts`
- `src/lib/voice-v3/calendar/google/google-find-availability.ts`
- `src/lib/voice-v3/calendar/google/google-create-booking.ts`
- `src/lib/voice-v3/calendar/google/google-update-booking.ts`
- `src/lib/voice-v3/calendar/google/google-cancel-booking.ts`
- `src/lib/voice-v3/calendar/google/google-find-existing-appointments.ts`
- `src/lib/voice-v3/calendar/google/google-get-event.ts`
- `src/lib/voice-v3/calendar/google/validate-google-appointment.ts`
- `src/lib/voice-v3/calendar/google/google-reconcile-mutation-outcome.ts`
- `scripts/test-voice-v3-google-calendar-provider.ts`

## 3. Existing Google functions reused

From `src/lib/calendar/providers.ts` (canonical — not duplicated):

`getValidAccessToken`, `getGoogleBusy`, `listGoogleCalendarEvents`, `getGoogleCalendarEvent`, `insertGoogleEvent`, `updateGoogleEvent`, `deleteGoogleEvent`, `resolveWriteCalendarId`, `resolveBlockingCalendarIds`, `hasOAuthTokens`, `ProviderCalendarEvent`

OAuth/connections unchanged: `src/lib/calendar/oauth.ts`, integration routes, `voiceCalendarConnection`.

## 4. Wizard strategy mapping

- `VoiceWizardBookingStrategy` includes `GOOGLE_CALENDAR`.
- `deriveBookingStrategyFromWizard`: `book_directly` + `calendarConnected` + `calendarProvider === "google"` → `GOOGLE_CALENDAR` (no longer `REQUEST_ONLY`).
- Wizard may also pin `bookingStrategy: "GOOGLE_CALENDAR"` explicitly.

## 5. Published-config mapping

- `resolveGoogleProviderConnections` (in `from-published-agent.ts`): workspace Google connection → `googleConnectionId` + `googleCalendarIds` (blocking calendars or write calendar).
- `compileVoiceV3AgentConfig`: when strategy is `GOOGLE_CALENDAR`, sets `calendar: { provider: "google", connectionId, calendarIds }`.
- Microsoft compile path unchanged.

## 6. Provider-dispatch changes

- **FIND / revalidate busy:** `fetchV3ProviderBusyIntervals` branches on `config.calendar.provider` → `fetchGoogleBusyIntervals` or existing `fetchMicrosoftBusyIntervals`.
- **BOOK create:** `book-dispatch` loads connection by provider → `executeGoogleCreateBooking` or `executeMicrosoftCreateBooking`.
- **FIND existing:** `loadProviderCalendarCandidates` → Google or Microsoft discovery.
- **RESCHEDULE / CANCEL:** Google validate/update/delete + Google reconcile on outcome uncertainty; Microsoft blocks preserved verbatim.

## 7. FIND implementation

Google: resolve connection → `getValidAccessToken` → per `calendarIds` call `getGoogleBusy` → `CalendarBusyInterval[]` → existing `generateAvailabilitySlots` / offer-set pipeline (unchanged).

## 8. BOOK implementation

Unchanged V3 lifecycle (slot validation → revalidate → commit → `BOOKING_CONFIRMED`). Google-only: `insertGoogleEvent` via `executeGoogleCreateBooking`; returns `providerEventId`, `providerCalendarId`, `durationMs`. `ConfirmedBooking.provider` set from `config.calendar.provider`.

## 9. FIND EXISTING implementation

`listGoogleCalendarEvents` → same identity extraction as Microsoft (`extractTransovoLabeledIdentity`, `extractIdentityFromEventFields`) → `ExistingAppointment` with `provider: "google"` and `stableGoogleDiscoveryBookingId`.

## 10. RESCHEDULE implementation

`validateGoogleAppointmentBeforeMutation` → `executeGoogleUpdateBooking` (`updateGoogleEvent`); uncertain outcomes use `reconcileGoogleRescheduleOutcome` (`getGoogleCalendarEvent`).

## 11. CANCEL implementation

`validateGoogleAppointmentBeforeMutation` → `executeGoogleCancelBooking` (`deleteGoogleEvent`); reconcile via `reconcileGoogleCancelOutcome`.

## 12. Failure mapping

- FIND: `google_token`, `google_throttled`, etc. on failure union; `mapProviderFailureToRecoveryCode` recognizes `google_token` / `google_throttled`.
- BOOK: `GOOGLE_AUTH_FAILED`, `GOOGLE_THROTTLED`, `GOOGLE_TEMPORARY_FAILURE` (parallel to Microsoft codes). Microsoft mapping unchanged.

## 13. Microsoft behavior

Microsoft code paths in `microsoft/*` modules are **not modified**. Dispatch uses shared busy helper but Microsoft branch still calls the same `fetchMicrosoftBusyIntervals` and Microsoft executors when `provider === "microsoft"`.

## 14. Legacy orchestration

**Not imported:** `src/lib/voice/calendar/booking.ts`, `/api/voice/calendars/*` scheduling. Adapters import **`@/lib/calendar/providers`** only.

## 15. Tests added

`scripts/test-voice-v3-google-calendar-provider.ts` — strategy derivation, compile, tool authorization, slot generation from normalized busy, discovery id stability, connection resolve.

## 16. Tests run + results

| Command | Result |
|---------|--------|
| `npx tsx scripts/test-voice-v3-google-calendar-provider.ts` | **PASS** (A config, B authorization, C slot path, G discovery id, connection resolve) |
| `npx tsx scripts/test-voice-v3-microsoft-connection-resolve.ts` | **PASS** |
| `npx tsx scripts/test-voice-v3-microsoft-appointment-management.ts` | **PASS** (Microsoft regression — FIND existing / cancel / reschedule flows) |
| `npx tsx scripts/test-voice-v3-scheduling-architecture-guards.ts` | **PASS** |

Not run in CI on this branch (requires live Google + workspace):

- D–F Google BOOK / RESCHEDULE / CANCEL against real Calendar API
- H token refresh with expired access token (relies on existing `getValidAccessToken` at runtime)
- PSTN E2E FIND→BOOK→RESCHEDULE→CANCEL on Google-connected agent

## 17. Typecheck / build

`npx tsc -p tsconfig.json --noEmit` — **fails** with hundreds of pre-existing errors elsewhere in the repo (exit 1); no new errors were introduced in the Voice V3 Google adapter paths validated by the scripts above. Full production build was **not** run for this task.

## 18. Remaining Google-specific gaps

- Post-confirmation persistence (`VoiceCall.appointmentBooked`, `voice_appointments`) — **unchanged** (shared defect; out of scope).
- OAuth profile/email on connect; token revoke on disconnect — **unchanged** (separate lifecycle).
- Live PSTN E2E FIND→BOOK→RESCHEDULE→CANCEL on Google-connected agent — **manual next step**.
- Optional: dedicated mock-based tests for `executeGoogleCreateBooking` with stubbed fetch (not added).

## 19. Commit SHA

`02fc3415` — `feat(voice-v3): wire Google Calendar to V3 scheduling provider boundary`
