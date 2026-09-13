import "server-only";

import { getPrisma } from "@/lib/db";
import { hasOAuthTokens, type CalendarConfig } from "@/lib/calendar/providers";
import { getMicrosoftCalendarCapabilities } from "@/lib/microsoft/calendar-capabilities";

export type MicrosoftBookingPreflightResult =
  | {
      status: "READY_TO_BOOK";
      calendarConnectionId: string;
      transactionId: string;
      inviteAttendee: boolean;
      customerEmail: string | null;
    }
  | { status: "MISSING_REQUIRED_DATA"; field: "EMAIL" | "NAME"; message: string }
  | { status: "NOT_READY"; message: string };

/** MS-EVT-003 — validate before Graph event create */
export async function prepareMicrosoftBooking(input: {
  workspaceId: string;
  calendarConnectionId?: string | null;
  customerName: string;
  customerEmail?: string | null;
  conversationId?: string | null;
  slotStartUtc: string;
  requireCustomerInvite?: boolean;
  transactionId?: string | null;
}): Promise<MicrosoftBookingPreflightResult> {
  if (!input.customerName?.trim()) {
    return {
      status: "MISSING_REQUIRED_DATA",
      field: "NAME",
      message: "I need your name to complete the booking.",
    };
  }

  const requireInvite = input.requireCustomerInvite !== false;
  if (requireInvite && !input.customerEmail?.trim()) {
    return {
      status: "MISSING_REQUIRED_DATA",
      field: "EMAIL",
      message: "What's the best email for the calendar invitation?",
    };
  }

  const prisma = getPrisma();
  const conn = input.calendarConnectionId
    ? await prisma.voiceCalendarConnection.findFirst({
        where: {
          id: input.calendarConnectionId,
          workspaceId: input.workspaceId,
          provider: "microsoft",
        },
      })
    : await prisma.voiceCalendarConnection.findFirst({
        where: { workspaceId: input.workspaceId, provider: "microsoft", status: "connected" },
        orderBy: { createdAt: "asc" },
      });

  if (!conn) {
    return { status: "NOT_READY", message: "Microsoft calendar is not connected" };
  }

  const config = (conn.config || {}) as CalendarConfig;
  if (!hasOAuthTokens(config)) {
    return { status: "NOT_READY", message: "Microsoft calendar authentication expired" };
  }

  const caps = await getMicrosoftCalendarCapabilities(input.workspaceId, {
    calendarConnectionId: conn.id,
  });
  if (!caps.canCreateBooking) {
    return {
      status: "NOT_READY",
      message: caps.notes[0] || "Microsoft AI Booking is not ready for this calendar",
    };
  }

  const transactionId =
    input.transactionId?.trim() ||
    `mctb-${input.conversationId || "sms"}-${input.slotStartUtc}`.slice(0, 250);

  return {
    status: "READY_TO_BOOK",
    calendarConnectionId: conn.id,
    transactionId,
    inviteAttendee: Boolean(input.customerEmail?.trim()),
    customerEmail: input.customerEmail?.trim() || null,
  };
}
