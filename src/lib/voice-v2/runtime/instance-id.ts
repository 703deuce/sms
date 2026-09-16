import "server-only";
import { hostname } from "node:os";

let cached: string | null = null;

/** Stable per-runtime identifier for cross-replica PSTN forensics. */
export function getVoiceV2InstanceId(): string {
  if (cached) return cached;
  const host = process.env.HOSTNAME?.trim() || hostname() || "unknown-host";
  cached = `${host}:${process.pid}`;
  return cached;
}
