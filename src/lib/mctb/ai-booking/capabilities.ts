import { getPrisma } from "@/lib/db";
import { getConnection } from "@/lib/integrations/connections";
import { hasOAuthTokens, type CalendarConfig } from "@/lib/voice/calendar/providers";
import type {
  MctbAiBookingProviderId,
  MctbBookingProviderSummary,
  MctbProviderCapabilityFlags,
} from "@/lib/mctb/ai-booking/types";

/**
 * Mechanical capability audit — never mark YES without a real code path.
 * AI Booking requires read + availability + create booking.
 */
export async function auditMctbAiBookingProvider(
  workspaceId: string,
  provider: MctbAiBookingProviderId,
): Promise<MctbProviderCapabilityFlags> {
  const notes: string[] = [];

  if (provider === "zoho") {
    const conn = await getConnection(workspaceId, "zoho");
    if (conn?.status === "connected") {
      notes.push("Zoho CRM connected — no calendar/scheduling adapter in codebase");
    }
    return {
      readCalendar: false,
      checkAvailability: false,
      createBooking: false,
      aiBookingSupported: false,
      notes,
    };
  }

  if (provider === "calendly") {
    const { getCalendlyCapabilities } = await import(
      "@/lib/integrations/adapters/calendly-capabilities"
    );
    const { loadMctbAiBookingConfig } = await import("@/lib/mctb/ai-booking/config");
    const cfg = await loadMctbAiBookingConfig(workspaceId);
    const caps = await getCalendlyCapabilities(workspaceId, {
      eventTypeUri: cfg.eventTypeUri,
    });
    if (!caps.connected) notes.push("Calendly integration not connected");
    notes.push(...caps.notes);
    notes.push("Availability: GET /event_type_available_times; booking: POST /invitees");
    if (caps.planBlocked) notes.push("Direct booking blocked by Calendly plan — use booking link fallback");
    if (caps.health === "CONNECTED_MISSING_SCOPES") {
      notes.push("Reconnect Calendly for AI Booking scopes (availability:read, scheduled_events:write)");
    }
    return {
      readCalendar: caps.canReadEventTypes,
      checkAvailability: caps.canReadAvailability,
      createBooking: caps.canCreateBooking && caps.directBookingPreflightOk,
      aiBookingSupported:
        caps.canReadAvailability && caps.canCreateBooking && caps.directBookingPreflightOk,
      notes,
    };
  }

  if (provider === "microsoft") {
    const { loadMctbAiBookingConfig } = await import("@/lib/mctb/ai-booking/config");
    const { getMicrosoftCalendarCapabilities } = await import(
      "@/lib/microsoft/calendar-capabilities"
    );
    const cfg = await loadMctbAiBookingConfig(workspaceId);
    const caps = await getMicrosoftCalendarCapabilities(workspaceId, {
      calendarConnectionId: cfg.calendarId,
    });
    if (!caps.connected) notes.push("No connected Microsoft calendar with valid OAuth tokens");
    notes.push(...caps.notes);
    notes.push("Availability: getSchedule (work/school) or calendarView + Transovo booking policy");
    notes.push("Booking: POST calendar event via microsoftGraphFetch (transactionId for idempotency)");
    if (caps.health === "CONNECTED_NO_REFRESH") {
      notes.push("Reconnect Microsoft with offline_access for unattended AI Booking");
    }
    if (caps.accountType === "personal") {
      notes.push("Personal account: no delegated getSchedule — calendarView busy derivation");
    }
    return {
      readCalendar: caps.canReadEvents,
      checkAvailability: caps.connected && caps.calendarSelected,
      createBooking: caps.canCreateBooking,
      aiBookingSupported:
        caps.canCreateBooking && caps.calendarSelected && caps.calendarEditable,
      notes,
    };
  }

  return {
    readCalendar: false,
    checkAvailability: false,
    createBooking: false,
    aiBookingSupported: false,
    notes: ["Unknown provider"],
  };
}

export async function getBookingProviders(workspaceId: string): Promise<MctbBookingProviderSummary[]> {
  const ids: MctbAiBookingProviderId[] = ["microsoft", "calendly", "zoho"];
  const display: Record<MctbAiBookingProviderId, string> = {
    microsoft: "Microsoft Calendar",
    calendly: "Calendly",
    zoho: "Zoho CRM",
  };
  const out: MctbBookingProviderSummary[] = [];
  for (const id of ids) {
    const capabilities = await auditMctbAiBookingProvider(workspaceId, id);
    const connected =
      id === "microsoft"
        ? capabilities.readCalendar
        : (await getConnection(workspaceId, id))?.status === "connected";
    out.push({
      id,
      displayName: display[id],
      connected: Boolean(connected),
      capabilities,
    });
  }
  return out;
}
