import { getPrisma } from "@/lib/db";
import type { MctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import type { MctbAiBookingSession, MctbBookingSlot } from "@/lib/mctb/ai-booking/types";

const SESSION_TTL_MS = 45 * 60_000;

function rowToSession(row: {
  conversationId: string;
  workspaceId: string;
  provider: string | null;
  offeredSlotsJson: unknown;
  requestedWindowJson: unknown;
  selectedSlotJson: unknown;
  schedulingTargetJson: unknown;
  stage: string;
  updatedAt: Date;
  expiresAt: Date | null;
}): MctbAiBookingSession {
  const offered = Array.isArray(row.offeredSlotsJson)
    ? (row.offeredSlotsJson as MctbBookingSlot[])
    : [];
  const scheduling =
    row.schedulingTargetJson && typeof row.schedulingTargetJson === "object"
      ? (row.schedulingTargetJson as { bookingTimezone?: string })
      : {};
  return {
    conversationId: row.conversationId,
    workspaceId: row.workspaceId,
    provider: (row.provider as MctbAiBookingSession["provider"]) || "microsoft",
    bookingTimezone: scheduling.bookingTimezone,
    offeredSlots: offered,
    lastQueriedWindow:
      row.requestedWindowJson && typeof row.requestedWindowJson === "object"
        ? (row.requestedWindowJson as { startUtc: string; endUtc: string })
        : undefined,
    pendingSlotId:
      row.selectedSlotJson && typeof row.selectedSlotJson === "object"
        ? String((row.selectedSlotJson as { slotId?: string }).slotId || "") || null
        : null,
    stage: row.stage,
    updatedAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

export const prismaMctbAiBookingSessionStore: MctbAiBookingSessionStore = {
  async get(conversationId) {
    const prisma = getPrisma();
    const row = await prisma.mctbAiBookingSession.findUnique({
      where: { conversationId },
    });
    if (!row) return null;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      await prisma.mctbAiBookingSession.delete({ where: { conversationId } }).catch(() => undefined);
      return null;
    }
    return rowToSession(row);
  },

  async save(session) {
    const prisma = getPrisma();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.mctbAiBookingSession.upsert({
      where: { conversationId: session.conversationId },
      create: {
        workspaceId: session.workspaceId,
        conversationId: session.conversationId,
        stage: session.stage || "AWAITING_SLOT_SELECTION",
        provider: session.provider,
        offeredSlotsJson: session.offeredSlots,
        requestedWindowJson: session.lastQueriedWindow ?? undefined,
        schedulingTargetJson: session.bookingTimezone
          ? { bookingTimezone: session.bookingTimezone }
          : undefined,
        selectedSlotJson: session.pendingSlotId
          ? session.offeredSlots.find((s) => s.slotId === session.pendingSlotId)
          : undefined,
        expiresAt,
      },
      update: {
        stage: session.stage || "AWAITING_SLOT_SELECTION",
        provider: session.provider,
        offeredSlotsJson: session.offeredSlots,
        requestedWindowJson: session.lastQueriedWindow ?? undefined,
        schedulingTargetJson: session.bookingTimezone
          ? { bookingTimezone: session.bookingTimezone }
          : undefined,
        selectedSlotJson: session.pendingSlotId
          ? session.offeredSlots.find((s) => s.slotId === session.pendingSlotId)
          : undefined,
        expiresAt,
      },
    });
  },

  async clear(conversationId) {
    const prisma = getPrisma();
    await prisma.mctbAiBookingSession.deleteMany({ where: { conversationId } });
  },
};
