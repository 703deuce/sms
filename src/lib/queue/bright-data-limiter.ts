/**
 * Bright Data capacity control — delegates to the shared Maps provider limiter
 * (`provider:brightdata:maps`) so all workers share one global semaphore.
 */

import { brightDataFairChunkSize } from "@/lib/queue/config";
import { acquireMapsProviderSlot } from "@/lib/queue/maps-provider-limiter";

type Slot = { release: () => Promise<void> };

/** Acquire one global Bright Data start slot (rate + in-flight). */
export async function acquireBrightDataSlot(timeoutMs = 30_000): Promise<Slot> {
  return acquireMapsProviderSlot("brightdata", timeoutMs);
}

export function fairChunkSize(): number {
  return brightDataFairChunkSize();
}

/** Acquire N slots (best-effort sequential). Releases all on failure. */
export async function acquireBrightDataSlots(
  count: number,
  timeoutMs = 30_000
): Promise<Slot[]> {
  const slots: Slot[] = [];
  try {
    for (let i = 0; i < count; i++) {
      slots.push(await acquireBrightDataSlot(timeoutMs));
    }
    return slots;
  } catch (err) {
    await Promise.all(slots.map((s) => s.release()));
    throw err;
  }
}
