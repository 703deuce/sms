import { buildAdapterContext } from "@/lib/integrations/framework/context";
import {
  bookEventInvitee,
  listEventTypeAvailableTimes,
} from "@/lib/integrations/adapters/calendly-actions";
import { getConnection } from "@/lib/integrations/connections";
import type { MctbAiBookingWorkspaceConfig } from "@/lib/mctb/ai-booking/config";
import { slotIdFor } from "@/lib/mctb/ai-booking/slot-id";
import type {
  CreateBookingRequest,
  CreateBookingResult,
  FindAvailableTimesRequest,
  FindAvailableTimesResult,
  MctbBookingContext,
  BookingStatusResult,
} from "@/lib/mctb/ai-booking/types";
import type { MctbAiBookingProviderAdapter } from "@/lib/mctb/ai-booking/providers/adapter";

const DEFAULT_DURATION_MIN = 30;

export const calendlyAiBookingAdapter: MctbAiBookingProviderAdapter = {
  id: "calendly",

  async getBookingContext(workspaceId, config) {
    const conn = await getConnection(workspaceId, "calendly");
    const connected = Boolean(conn && conn.status === "connected");
    const timezone = config.timezone || "America/New_York";
    return {
      provider: "calendly",
      connected,
      healthy: connected,
      timezone,
      durationMinutes: DEFAULT_DURATION_MIN,
      eventTypeUri: config.eventTypeUri,
      serviceName: config.serviceName,
      fallbackBookingLinkId: config.fallbackBookingLinkId,
    };
  },

  async findAvailableTimes(ctx, config, req) {
    if (!ctx.connected) {
      return { ok: false, reason: "Calendly is not connected", fallbackRecommended: true };
    }
    try {
      const adapterCtx = await buildAdapterContext(req.workspaceId, "calendly");
      const { slots: raw } = await listEventTypeAvailableTimes(adapterCtx, {
        eventTypeUri: config.eventTypeUri || undefined,
        startTime: req.windowStartUtc,
        endTime: req.windowEndUtc,
      });
      const tz = req.timezone || ctx.timezone;
      const slots = raw
        .filter((s) => /available/i.test(s.status) || !s.status)
        .map((s) => {
          const startUtc = s.startTime;
          const end = new Date(new Date(startUtc).getTime() + ctx.durationMinutes * 60_000).toISOString();
          return {
            slotId: slotIdFor(startUtc, end, "calendly"),
            startUtc,
            endUtc: end,
            timezone: tz,
          };
        });
      return {
        ok: true,
        provider: "calendly",
        slots,
        queriedWindow: { startUtc: req.windowStartUtc, endUtc: req.windowEndUtc },
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Calendly availability failed";
      return { ok: false, reason, fallbackRecommended: true };
    }
  },

  async createBooking(ctx, config, req, resolvedSlot) {
    if (!ctx.connected) {
      return { ok: false, reason: "Calendly is not connected", fallbackRecommended: true };
    }
    const email = req.customerEmail?.trim();
    const name = req.customerName?.trim();
    if (!email || !name) {
      return {
        ok: false,
        reason: "Customer name and email required for Calendly booking",
        fallbackRecommended: true,
      };
    }
    try {
      const adapterCtx = await buildAdapterContext(req.workspaceId, "calendly");
      const booked = await bookEventInvitee(adapterCtx, {
        eventTypeUri: config.eventTypeUri || undefined,
        startTime: resolvedSlot.startUtc,
        name,
        email,
        timezone: ctx.timezone,
        phone: req.customerPhone,
      });
      return {
        ok: true,
        provider: "calendly",
        providerBookingId: booked.eventUri || booked.inviteeUri,
        startUtc: resolvedSlot.startUtc,
        endUtc: resolvedSlot.endUtc,
        timezone: ctx.timezone,
        status: booked.status === "active" ? "confirmed" : "pending",
        inviteSent: true,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Calendly booking failed";
      return { ok: false, reason, fallbackRecommended: true };
    }
  },

  async getBookingStatus(workspaceId, config, providerBookingId) {
    try {
      const { getAppointment } = await import("@/lib/integrations/adapters/calendly-actions");
      const adapterCtx = await buildAdapterContext(workspaceId, "calendly");
      const eventUri = providerBookingId.startsWith("http")
        ? providerBookingId
        : `https://api.calendly.com/scheduled_events/${providerBookingId}`;
      const appt = await getAppointment(adapterCtx, { eventUri });
      const start = String(appt.event?.start_time || "");
      const end = String(appt.event?.end_time || "");
      return {
        ok: true,
        provider: "calendly",
        providerBookingId,
        status: String(appt.event?.status || "unknown"),
        startUtc: start || undefined,
        endUtc: end || undefined,
      };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "Status unavailable" };
    }
  },
};
