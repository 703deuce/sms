/**
 * When PostgreSQL still shows pending/deferred but BullMQ already finished the job,
 * outbox recovery must align PG — not enqueue a duplicate executable job.
 */
export type BullmqOutboxTerminalState = "completed" | "failed";

export function bullmqOutboxShouldAlignPostgresTerminal(
  bullmqState: string | null | undefined,
): BullmqOutboxTerminalState | null {
  if (bullmqState === "completed") return "completed";
  if (bullmqState === "failed") return "failed";
  return null;
}
