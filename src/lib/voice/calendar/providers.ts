/**
 * @deprecated Import from `@/lib/calendar` — workspace calendar integrations are platform-level.
 */
export {
  computeFreeSlots,
  deleteGoogleEvent,
  deleteMicrosoftEvent,
  getGoogleBusy,
  getGoogleCalendars,
  getMicrosoftBusy,
  getMicrosoftCalendars,
  getValidAccessToken,
  hasOAuthTokens,
  insertGoogleEvent,
  insertMicrosoftEvent,
  resolveBlockingCalendarIds,
  resolveWriteCalendarId,
  updateGoogleEvent,
  updateMicrosoftEvent,
  type BusyInterval,
  type CalendarConfig,
  type ProviderCalendar,
} from "@/lib/calendar/providers";
