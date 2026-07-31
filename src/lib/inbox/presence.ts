/**
 * In-memory conversation presence (short-lived, per server instance).
 * Heartbeats expire after PRESENCE_TTL_MS without refresh.
 */

export type PresenceViewer = {
  userId: string;
  userName: string;
  lastSeen: number;
};

const PRESENCE_TTL_MS = 45_000;

/** conversationId → userId → viewer */
const store = new Map<string, Map<string, PresenceViewer>>();

function pruneConversation(conversationId: string) {
  const room = store.get(conversationId);
  if (!room) return;
  const now = Date.now();
  for (const [userId, entry] of room) {
    if (now - entry.lastSeen > PRESENCE_TTL_MS) room.delete(userId);
  }
  if (room.size === 0) store.delete(conversationId);
}

export function recordPresence(
  conversationId: string,
  userId: string,
  userName: string,
): PresenceViewer[] {
  const now = Date.now();
  let room = store.get(conversationId);
  if (!room) {
    room = new Map();
    store.set(conversationId, room);
  }
  room.set(userId, { userId, userName, lastSeen: now });
  pruneConversation(conversationId);
  return getPresentUsers(conversationId, userId);
}

export function getPresentUsers(
  conversationId: string,
  excludeUserId?: string,
): PresenceViewer[] {
  pruneConversation(conversationId);
  const room = store.get(conversationId);
  if (!room) return [];
  const now = Date.now();
  return Array.from(room.values())
    .filter(
      (v) =>
        now - v.lastSeen <= PRESENCE_TTL_MS &&
        v.userId !== excludeUserId,
    )
    .sort((a, b) => a.userName.localeCompare(b.userName));
}
