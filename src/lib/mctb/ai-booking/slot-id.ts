import { createHash } from "node:crypto";

export function slotIdFor(startUtc: string, endUtc: string, provider: string): string {
  const raw = `${provider}|${startUtc}|${endUtc}`;
  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  return `slot_${digest}`;
}
