import { createId } from "@/lib/supabase/id";
import type { MctbAiBookingSession, MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import { prismaMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store-prisma";

export type MctbAiBookingSessionStore = {
  get(conversationId: string): Promise<MctbAiBookingSession | null>;
  save(session: MctbAiBookingSession): Promise<void>;
  clear(conversationId: string): Promise<void>;
};

const memory = new Map<string, MctbAiBookingSession>();

export const inMemoryMctbAiBookingSessionStore: MctbAiBookingSessionStore = {
  async get(conversationId) {
    return memory.get(conversationId) ?? null;
  },
  async save(session) {
    memory.set(session.conversationId, session);
  },
  async clear(conversationId) {
    memory.delete(conversationId);
  },
};

let activeStore: MctbAiBookingSessionStore = prismaMctbAiBookingSessionStore;

export function setMctbAiBookingSessionStore(store: MctbAiBookingSessionStore) {
  activeStore = store;
}

export function getMctbAiBookingSessionStore() {
  return activeStore;
}

export async function recordOfferedSlots(input: {
  workspaceId: string;
  conversationId: string;
  provider: MctbAiBookingSession["provider"];
  bookingTimezone: string;
  slots: MctbBookingSlot[];
  window?: { startUtc: string; endUtc: string };
  stage?: MctbAiBookingSession["stage"];
}) {
  const offerSetId = `offer_${createId()}`;
  const session: MctbAiBookingSession = {
    conversationId: input.conversationId,
    workspaceId: input.workspaceId,
    provider: input.provider,
    offerSetId,
    bookingTimezone: input.bookingTimezone,
    stage: input.stage || "AWAITING_SLOT_SELECTION",
    offeredSlots: input.slots,
    lastQueriedWindow: input.window,
    pendingSlotId: null,
    updatedAt: new Date().toISOString(),
  };
  await getMctbAiBookingSessionStore().save(session);
  return session;
}
