import { getPrisma } from "@/lib/db";
import type { MctbAiBookingProviderId } from "@/lib/mctb/ai-booking/types";

export type BookingConfirmedPayload = {
  provider: MctbAiBookingProviderId;
  providerBookingId: string;
  title: string;
  startUtc: string;
  endUtc: string;
  timezone: string;
  location?: string | null;
  joinUrl?: string | null;
  confirmationUrl?: string | null;
};

export async function recordMctbBookingConfirmedActivity(input: {
  workspaceId: string;
  conversationId: string;
  contactId?: string | null;
  payload: BookingConfirmedPayload;
}) {
  const prisma = getPrisma();
  await prisma.mctbConversationBookingActivity.create({
    data: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      contactId: input.contactId ?? null,
      kind: "BOOKING_CONFIRMED",
      payloadJson: input.payload,
    },
  });
}

export async function recordMctbAiBookingFallbackActivity(input: {
  workspaceId: string;
  conversationId: string;
  contactId?: string | null;
  reason: string;
}) {
  const prisma = getPrisma();
  await prisma.mctbConversationBookingActivity.create({
    data: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      contactId: input.contactId ?? null,
      kind: "AI_BOOKING_FALLBACK",
      payloadJson: { reason: input.reason },
    },
  });
}

export async function listMctbConversationBookingActivities(
  workspaceId: string,
  conversationId: string,
) {
  const prisma = getPrisma();
  return prisma.mctbConversationBookingActivity.findMany({
    where: { workspaceId, conversationId },
    orderBy: { createdAt: "asc" },
  });
}

export function formatBookingConfirmedEventText(payload: BookingConfirmedPayload): string {
  const start = new Date(payload.startUtc);
  const when = start.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: payload.timezone,
  });
  const providerLabel =
    payload.provider === "microsoft"
      ? "Microsoft Calendar"
      : payload.provider === "calendly"
        ? "Calendly"
        : payload.provider;
  return `BOOKING CONFIRMED — ${payload.title} — ${when} — ${providerLabel}`;
}
