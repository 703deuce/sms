/** Conversation-minute math — no server-only (safe for tests). */

export function conversationMinutesFromSession(input: {
  startedAt: Date;
  answeredAt?: Date | null;
  completedAt?: Date | null;
}): number {
  const end = input.completedAt || input.answeredAt || input.startedAt;
  const start = input.answeredAt || input.startedAt;
  const ms = Math.max(0, end.getTime() - start.getTime());
  return Math.max(1, Math.ceil(ms / 60_000));
}
