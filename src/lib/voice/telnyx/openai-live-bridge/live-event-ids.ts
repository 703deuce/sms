import crypto from "node:crypto";

export function liveBaselineEventId(prefix = "evt"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
