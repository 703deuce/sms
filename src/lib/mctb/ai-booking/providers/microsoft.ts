import { getPrisma } from "@/lib/db";
import { bookAppointment, getAvailability } from "@/lib/voice/calendar/booking";
import { hasOAuthTokens, type CalendarConfig } from "@/lib/voice/calendar/providers";
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

export const microsoftAiBookingAdapter: MctbAiBookingProviderAdapter = {
  id: "microsoft",

  async getBookingContext(workspaceId, config) {
    const prisma = getPrisma();
    const connId = config.calendarId || config.calendarConnectionId;
    const conn = connId
      ? await prisma.voiceCalendarConnection.findFirst({
          where: { id: connId, workspaceId, provider: "microsoft" },
        })
      : await prisma.voiceCalendarConnection.findFirst({
          where: { workspaceId, provider: "microsoft", status: "connected" },
          orderBy: { createdAt: "asc" },
        });
    const calCfg = (conn?.config || {}) as CalendarConfig;
    const connected = Boolean(conn && conn.status === "connected" && hasOAuthTokens(calCfg));
    const timezone = config.timezone || calCfg.timezone || "America/New_York";
    const serviceName = config.serviceName || "Consultation";
    const service = await prisma.voiceService.findFirst({
      where: { workspaceId, name: serviceName },
    });
    const durationMinutes = service?.durationMinutes || 30;
    return {
      provider: "microsoft",
      connected,
      healthy: connected,
      timezone,
      durationMinutes,
      serviceName,
      calendarId: conn?.id ?? null,
      fallbackBookingLinkId: config.fallbackBookingLinkId,
    };
  },

  async findAvailableTimes(ctx, config, req) {
    if (!ctx.connected) {
      return { ok: false, reason: "Microsoft calendar is not connected", fallbackRecommended: true };
    }
    try {
      const { slots: raw } = await getAvailability(req.workspaceId, {
        serviceName: config.serviceName || ctx.serviceName || "Consultation",
        startTime: req.windowStartUtc,
        endTime: req.windowEndUtc,
        timezone: req.timezone || ctx.timezone,
        calendarId: ctx.calendarId,
        maxSlots: req.maxResults || 24,
      });
      const slots = raw.map((s) => ({
        slotId: slotIdFor(s.startsAt, s.endsAt, "microsoft"),
        startUtc: s.startsAt,
        endUtc: s.endsAt,
        timezone: req.timezone || ctx.timezone,
        label: s.staffName || s.location,
      }));
      return {
        ok: true,
        provider: "microsoft",
        slots,
        queriedWindow: { startUtc: req.windowStartUtc, endUtc: req.windowEndUtc },
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Microsoft availability failed";
      return { ok: false, reason, fallbackRecommended: true };
    }
  },

  async createBooking(ctx, config, req, resolvedSlot) {
    if (!ctx.connected) {
      return { ok: false, reason: "Microsoft calendar is not connected", fallbackRecommended: true };
    }
    try {
      const { prepareMicrosoftBooking } = await import("@/lib/microsoft/booking-preflight");
      const preflight = await prepareMicrosoftBooking({
        workspaceId: req.workspaceId,
        calendarConnectionId: ctx.calendarId || config.calendarId,
        customerName: req.customerName,
        customerEmail: req.customerEmail,
        conversationId: req.conversationId,
        slotStartUtc: resolvedSlot.startUtc,
        requireCustomerInvite: false,
      });
      if (preflight.status === "MISSING_REQUIRED_DATA") {
        return {
          ok: false,
          reason: preflight.message,
          fallbackRecommended: false,
        };
      }
      if (preflight.status === "NOT_READY") {
        return { ok: false, reason: preflight.message, fallbackRecommended: true };
      }

      const result = await bookAppointment(req.workspaceId, {
        serviceName: config.serviceName || ctx.serviceName || "Consultation",
        startsAt: resolvedSlot.startUtc,
        timezone: ctx.timezone,
        phone: req.customerPhone,
        contactId: req.contactId,
        customerName: req.customerName,
        email: req.customerEmail,
        calendarId: ctx.calendarId,
        source: "mctb_ai_booking",
      });
      const appointmentId = (result as { appointmentId?: string }).appointmentId;
      if (!appointmentId && !(result as { ok?: boolean }).ok) {
        throw new Error("Microsoft booking did not return appointment id");
      }
      const inviteSent = preflight.inviteAttendee && Boolean(req.customerEmail?.trim());
      return {
        ok: true,
        provider: "microsoft",
        providerBookingId: appointmentId || resolvedSlot.slotId,
        startUtc: resolvedSlot.startUtc,
        endUtc: resolvedSlot.endUtc,
        timezone: ctx.timezone,
        status: "confirmed",
        inviteSent,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Microsoft booking failed";
      return { ok: false, reason, fallbackRecommended: true };
    }
  },

  async getBookingStatus(workspaceId, _config, providerBookingId) {
    const prisma = getPrisma();
    const row = await prisma.appointment.findFirst({
      where: { workspaceId, id: providerBookingId },
      select: { id: true, status: true, startsAt: true, endsAt: true },
    });
    if (!row) {
      return { ok: false, reason: "Appointment not found" };
    }
    return {
      ok: true,
      provider: "microsoft",
      providerBookingId: row.id,
      status: row.status,
      startUtc: row.startsAt.toISOString(),
      endUtc: row.endsAt.toISOString(),
    };
  },
};
