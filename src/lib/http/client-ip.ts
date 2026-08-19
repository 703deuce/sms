import type { NextRequest } from "next/server";

/**
 * Resolve the client IP behind a reverse proxy.
 * Prefer the left-most trusted hop when TRUSTED_PROXY_COUNT is set;
 * otherwise use the first X-Forwarded-For value (Coolify/nginx default).
 */
export function getTrustedClientIp(request: Request | NextRequest): string | null {
  const trustedHops = Number(process.env.TRUSTED_PROXY_COUNT ?? "1");
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) {
      const idx = Math.max(0, parts.length - trustedHops);
      return parts[idx] ?? parts[0] ?? null;
    }
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return null;
}
