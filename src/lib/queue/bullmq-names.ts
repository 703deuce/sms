import type { QueueName } from "@/lib/queue/types";
import { JOB_QUEUES, ALL_QUEUE_NAMES } from "@/lib/queue/types";
import { getQueuePrefix } from "@/lib/queue/config";

/**
 * BullMQ reserves `:` as an internal Redis key separator.
 * Queue *names* must never include `:`. Use BullMQ's `prefix` option
 * for namespacing (`QUEUE_PREFIX`, default `lse`) instead of baking it
 * into the queue name as `${prefix}:${name}`.
 */
export function assertValidBullmqQueueName(name: string): asserts name is string {
  if (!name || !name.trim()) {
    throw new Error("Queue name must be provided");
  }
  if (name.includes(":")) {
    throw new Error(
      `Queue name cannot contain : (got ${JSON.stringify(name)}). ` +
        `Use a hyphenated name and pass QUEUE_PREFIX via BullMQ's prefix option.`
    );
  }
}

/** Validate a Redis key prefix (colons are allowed inside BullMQ prefix). */
export function assertValidBullmqPrefix(prefix: string): void {
  if (!prefix || !prefix.trim()) {
    throw new Error("BullMQ prefix must be a non-empty string");
  }
  if (prefix.includes(":")) {
    // Prefix may itself contain colons in some setups, but keep ours simple.
    throw new Error(
      `QUEUE_PREFIX must not contain : (got ${JSON.stringify(prefix)}). Use e.g. "lse".`
    );
  }
}

/**
 * Canonical BullMQ identity for a logical queue.
 * - `name`: hyphenated logical queue (no colon)
 * - `prefix`: Redis key namespace from QUEUE_PREFIX
 */
export function resolveBullmqQueueIdentity(queueName: QueueName): {
  name: QueueName;
  prefix: string;
} {
  assertValidBullmqQueueName(queueName);
  const prefix = getQueuePrefix();
  assertValidBullmqPrefix(prefix);
  return { name: queueName, prefix };
}

/** All registered logical queue names — single source of truth for workers/docs. */
export function listRegisteredQueueNames(): readonly QueueName[] {
  return ALL_QUEUE_NAMES;
}

/** Map used by worker profiles / admin — always import from here, never hardcode. */
export const QUEUE_NAME_REGISTRY = JOB_QUEUES;
