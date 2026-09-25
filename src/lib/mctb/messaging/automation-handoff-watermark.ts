import type { Prisma } from "@/lib/domain";

export type AutomationHandoffMetadata = {
  lastHumanTakeoverAtMs?: number;
};

export function readAutomationHandoffMetadata(metadataJson: unknown): AutomationHandoffMetadata {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return {};
  }
  const raw = (metadataJson as Record<string, unknown>).lastHumanTakeoverAtMs;
  const ms = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(ms) && ms > 0 ? { lastHumanTakeoverAtMs: ms } : {};
}

export function mergeLastHumanTakeoverMetadata(
  metadataJson: unknown,
  takeoverAtMs: number,
): Prisma.InputJsonValue {
  const base =
    metadataJson && typeof metadataJson === "object" && !Array.isArray(metadataJson)
      ? { ...(metadataJson as Record<string, unknown>) }
      : {};
  const prev = readAutomationHandoffMetadata(metadataJson).lastHumanTakeoverAtMs ?? 0;
  base.lastHumanTakeoverAtMs = Math.max(prev, takeoverAtMs);
  return base as Prisma.InputJsonValue;
}

/** Monotonic watermark — any AI job enqueued before this instant is stale after human takeover. */
export function resolveAutomationHandoffWatermarkMs(input: {
  humanTakenOverAt: Date | null | undefined;
  metadataJson: unknown;
}): number {
  const fromMeta = readAutomationHandoffMetadata(input.metadataJson).lastHumanTakeoverAtMs ?? 0;
  const fromRow = input.humanTakenOverAt?.getTime() ?? 0;
  return Math.max(fromMeta, fromRow);
}

export function isStaleAutonomousAiOutbound(input: {
  enqueuedAtIso: string;
  handoffWatermarkMs: number;
}): boolean {
  const enqueuedMs = Date.parse(input.enqueuedAtIso);
  if (!Number.isFinite(enqueuedMs)) return true;
  return input.handoffWatermarkMs > enqueuedMs;
}
