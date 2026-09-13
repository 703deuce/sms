import type { MctbAiBookingSession, MctbBookingSlot } from "@/lib/mctb/ai-booking/types";

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

let activeStore: MctbAiBookingSessionStore = inMemoryMctbAiBookingSessionStore;

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
  slots: MctbBookingSlot[];
  window?: { startUtc: string; endUtc: string };
}) {
  const session: MctbAiBookingSession = {
    conversationId: input.conversationId,
    workspaceId: input.workspaceId,
    provider: input.provider,
    offeredSlots: input.slots,
    lastQueriedWindow: input.window,
    pendingSlotId: null,
    updatedAt: new Date().toISOString(),
  };
  await getMctbAiBookingSessionStore().save(session);
  return session;
}
