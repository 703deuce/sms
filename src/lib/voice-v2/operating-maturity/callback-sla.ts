import type { VoiceV2CallbackSlaPolicy } from "./types";

export type VoiceV2CallbackLifecycleStatus =
  | "PENDING"
  | "ATTEMPTED"
  | "CONNECTED"
  | "COMPLETED"
  | "OVERDUE"
  | "CANCELED";

const LEGACY_TO_LIFECYCLE: Record<string, VoiceV2CallbackLifecycleStatus> = {
  new: "PENDING",
  contacted: "ATTEMPTED",
  completed: "COMPLETED",
  dismissed: "CANCELED",
};

export function mapLegacyCallbackStatus(status: string): VoiceV2CallbackLifecycleStatus {
  return LEGACY_TO_LIFECYCLE[status] || "PENDING";
}

export function computeCallbackDeadline(input: {
  policy: VoiceV2CallbackSlaPolicy;
  createdAt: Date;
  urgency?: "NORMAL" | "URGENT" | "CRITICAL";
}): Date {
  const urgent =
    input.urgency === "URGENT" || input.urgency === "CRITICAL";
  const target = urgent ? input.policy.urgentTarget : input.policy.normalTarget;
  const custom = urgent
    ? input.policy.urgentCustomMinutes
    : input.policy.normalCustomMinutes;

  const base = input.createdAt.getTime();
  switch (target) {
    case "immediate":
      return new Date(base);
    case "15m":
      return new Date(base + 15 * 60_000);
    case "30m":
      return new Date(base + 30 * 60_000);
    case "1h":
      return new Date(base + 60 * 60_000);
    case "next_business_day":
      return new Date(base + 24 * 60 * 60_000);
    case "custom":
      return new Date(base + (custom || 60) * 60_000);
    default:
      return new Date(base + 60 * 60_000);
  }
}

export function callbackSlaMetadataPatch(input: {
  policy: VoiceV2CallbackSlaPolicy;
  urgency?: "NORMAL" | "URGENT" | "CRITICAL";
  sourceVoiceCallId?: string;
  sourceRecoverySessionId?: string;
  preferredWindow?: string;
}): Record<string, unknown> {
  const createdAt = new Date();
  const deadline = computeCallbackDeadline({
    policy: input.policy,
    createdAt,
    urgency: input.urgency,
  });
  return {
    voiceV2CallbackSla: {
      lifecycle: "PENDING" as VoiceV2CallbackLifecycleStatus,
      policy: input.policy,
      urgency: input.urgency || "NORMAL",
      promisedDeadline: deadline.toISOString(),
      attemptCount: 0,
      sourceVoiceCallId: input.sourceVoiceCallId,
      sourceRecoverySessionId: input.sourceRecoverySessionId,
      preferredWindow: input.preferredWindow,
      overdueNotifiedAt: null,
    },
  };
}

export function shouldMarkCallbackOverdue(meta: Record<string, unknown>, now = new Date()): boolean {
  const sla = meta.voiceV2CallbackSla as Record<string, unknown> | undefined;
  if (!sla) return false;
  const lifecycle = String(sla.lifecycle || "");
  if (lifecycle !== "PENDING" && lifecycle !== "ATTEMPTED") return false;
  const deadline = String(sla.promisedDeadline || "");
  if (!deadline) return false;
  return Date.parse(deadline) < now.getTime();
}
