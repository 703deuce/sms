import "server-only";

import { getPrisma, type DbRow } from "@/lib/db";
import { listAppointmentTypes } from "@/lib/appointments/booking-platform";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { AppointmentPlatformConfig } from "@/lib/appointments/types";
import {
  applyStateHintsToUnderstanding,
  parseConversationState,
  type AppointmentConversationState,
} from "./conversation-state";
import { formatTimestampInTimezone } from "./date-utils";
import type { AppointmentAiChannel } from "./schema";

export type AppointmentAiContext = {
  requestId: string;
  workspaceId: string;
  channel: AppointmentAiChannel;
  message: string;
  currentTimestamp: string;
  businessTimezone: string;
  customerTimezone?: string;
  customerId?: string;
  conversationId?: string;
  conversationState: AppointmentConversationState | null;
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
  appointmentTypes: Array<{ id: string; name: string; active: boolean }>;
  staff: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  customerAppointments: Array<{
    id: string;
    serviceName: string;
    startsAt: string;
    status: string;
  }>;
  bookingEnabled: boolean;
  waitlistEnabled: boolean;
  platform: AppointmentPlatformConfig;
  scopedIds: {
    appointmentTypeIds: Set<string>;
    staffIds: Set<string>;
    locationIds: Set<string>;
    appointmentIds: Set<string>;
  };
};

export async function assembleAppointmentAiContext(input: {
  requestId: string;
  workspaceId: string;
  channel: AppointmentAiChannel;
  message: string;
  customerId?: string;
  conversationId?: string;
  customerTimezone?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  contactCustomFields?: unknown;
  now?: Date;
}): Promise<AppointmentAiContext> {
  const now = input.now || new Date();
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const types = (await listAppointmentTypes(input.workspaceId)).filter((t: DbRow) => t.active);
  const staff = (platform.staff || [])
    .filter((s) => s.active !== false)
    .map((s) => ({ id: s.id, name: s.name }));
  const locations = (platform.locations || [])
    .filter((l) => l.active !== false)
    .map((l) => ({ id: l.id, name: l.name }));

  let customerAppointments: AppointmentAiContext["customerAppointments"] = [];
  let conversationState = parseConversationState(input.contactCustomFields);

  if (input.customerId) {
    const prisma = getPrisma();
    const rows = await prisma.voiceAppointment.findMany({
      where: {
        workspaceId: input.workspaceId,
        contactId: input.customerId,
        startsAt: { gte: now },
        status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
      },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: { id: true, serviceName: true, startsAt: true, status: true },
    });
    customerAppointments = rows.map((r: DbRow) => ({
      id: r.id,
      serviceName: r.serviceName || "Appointment",
      startsAt: r.startsAt.toISOString(),
      status: r.status,
    }));
  }

  if (input.conversationId && !conversationState) {
    const prisma = getPrisma();
    const contact = input.customerId
      ? await prisma.contact.findFirst({
          where: { id: input.customerId, workspaceId: input.workspaceId },
          select: { customFields: true },
        })
      : null;
    conversationState = parseConversationState(contact?.customFields);
  }

  const recentTurns = (input.conversationHistory || []).slice(-6);

  const appointmentTypeIds = new Set<string>(types.map((t: DbRow) => String(t.id)));
  const staffIds = new Set<string>(staff.map((s: DbRow) => String(s.id)));
  const locationIds = new Set<string>(locations.map((l: DbRow) => String(l.id)));
  const appointmentIds = new Set<string>(customerAppointments.map((a: DbRow) => String(a.id)));

  return {
    requestId: input.requestId,
    workspaceId: input.workspaceId,
    channel: input.channel,
    message: input.message,
    currentTimestamp: formatTimestampInTimezone(now, platform.timezone),
    businessTimezone: platform.timezone,
    customerTimezone: input.customerTimezone,
    customerId: input.customerId,
    conversationId: input.conversationId,
    conversationState,
    recentTurns,
    appointmentTypes: types.map((t: DbRow) => ({ id: t.id, name: t.name, active: t.active })),
    staff,
    locations,
    customerAppointments,
    bookingEnabled: platform.bookingEnabled !== false,
    waitlistEnabled: true,
    platform,
    scopedIds: {
      appointmentTypeIds,
      staffIds,
      locationIds,
      appointmentIds,
    },
  };
}

export function contextSummaryForPrompt(ctx: AppointmentAiContext): string {
  const lines = [
    `Current timestamp: ${ctx.currentTimestamp}`,
    `Business timezone: ${ctx.businessTimezone}`,
  ];
  if (ctx.customerTimezone) lines.push(`Customer timezone: ${ctx.customerTimezone}`);
  lines.push(`Channel: ${ctx.channel}`);
  if (ctx.customerId) lines.push(`Customer ID: ${ctx.customerId}`);
  if (ctx.conversationId) lines.push(`Conversation ID: ${ctx.conversationId}`);

  if (ctx.appointmentTypes.length) {
    lines.push(
      "Bookable appointment types:",
      ...ctx.appointmentTypes.map((t) => `- ${t.name} (id: ${t.id})`),
    );
  }
  if (ctx.staff.length) {
    lines.push("Active staff:", ...ctx.staff.map((s) => `- ${s.name} (id: ${s.id})`));
  }
  if (ctx.locations.length) {
    lines.push("Locations:", ...ctx.locations.map((l) => `- ${l.name} (id: ${l.id})`));
  }
  if (ctx.customerAppointments.length) {
    lines.push(
      "Customer upcoming appointments:",
      ...ctx.customerAppointments.map(
        (a) => `- ${a.serviceName} at ${a.startsAt} (id: ${a.id}, status: ${a.status})`,
      ),
    );
  }
  if (ctx.conversationState?.lastOfferedSlots?.length) {
    lines.push(
      "Recently offered slots:",
      ...ctx.conversationState.lastOfferedSlots.map((s) => `- ${s.startsAt}`),
    );
  }
  if (ctx.conversationState?.activeIntent) {
    lines.push(`Active conversation intent: ${ctx.conversationState.activeIntent}`);
  }

  return lines.join("\n");
}

export { applyStateHintsToUnderstanding };
