import "server-only";

import {
  platformDispatchMaxWaitMs,
  platformDispatchRequireRedis,
  platformDispatchUseMemory,
} from "@/lib/messaging/platform-dispatch/config";
import { PlatformDispatchDeferredError } from "@/lib/messaging/platform-dispatch/errors";
import { acquirePlatformDispatchSlotMemory } from "@/lib/messaging/platform-dispatch/memory-coordinator";
import { acquirePlatformDispatchSlotRedis } from "@/lib/messaging/platform-dispatch/redis-coordinator";
import { PLATFORM_DISPATCH_PRIORITY_BULK } from "@/lib/messaging/platform-dispatch/priority";
import { getRedisUrl } from "@/lib/queue/config";
import type { QuickSendSmsInput } from "@/lib/sms/send-quick";
import { isTransovoPlatformOutboundSenderRoute } from "@/lib/messaging/platform-dispatch/is-platform-route";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type PlatformDispatchAcquireInput = {
  platformE164: string;
  reservationId: string;
  priority: number;
  notBeforeMs?: number;
};

/**
 * Acquire one distributed dispatch slot for the shared platform sender.
 * Throws PlatformDispatchDeferredError when capacity or priority defers (soft — not provider failure).
 */
export async function acquirePlatformDispatchSlot(
  input: PlatformDispatchAcquireInput,
): Promise<void> {
  const maxWaitMs = platformDispatchMaxWaitMs();
  const useMemory = platformDispatchUseMemory();
  const hasRedis = Boolean(getRedisUrl()?.trim());

  if (!useMemory && !hasRedis && platformDispatchRequireRedis()) {
    throw new PlatformDispatchDeferredError("redis_unavailable", 2_000);
  }

  const payload = {
    platformE164: normalizeE164(input.platformE164) || input.platformE164,
    reservationId: input.reservationId,
    priority: input.priority,
    notBeforeMs: input.notBeforeMs,
    enqueueMs: Date.now(),
    maxWaitMs,
  };

  if (useMemory || !hasRedis) {
    await acquirePlatformDispatchSlotMemory(payload);
    return;
  }
  await acquirePlatformDispatchSlotRedis(payload);
}

export async function assertPlatformDispatchForSendQuickSms(
  input: QuickSendSmsInput,
): Promise<void> {
  if (!input.senderRoute) return;
  const isPlatform = await isTransovoPlatformOutboundSenderRoute(input.senderRoute);
  if (!isPlatform) return;

  const reservationId =
    input.idempotencyKey?.trim() ||
    `ephemeral:${input.workspaceId}:${input.senderRoute.fromE164}:${input.to}:${input.body.length}`;

  const priority =
    typeof input.platformDispatchPriority === "number"
      ? input.platformDispatchPriority
      : PLATFORM_DISPATCH_PRIORITY_BULK;

  const notBeforeMs = input.platformDispatchNotBefore?.getTime();

  await acquirePlatformDispatchSlot({
    platformE164: input.senderRoute.fromE164,
    reservationId,
    priority,
    notBeforeMs,
  });
}

export { resetPlatformDispatchMemoryForTests } from "@/lib/messaging/platform-dispatch/memory-coordinator";
export { resetPlatformDispatchRedisForTests } from "@/lib/messaging/platform-dispatch/redis-coordinator";
