import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cleanSecret } from "@/lib/env/secrets";

/** Server-only secret for scan IP hashing. Never expose to the browser. */
export function getQrScanHashSecret(): string {
  return (
    cleanSecret(process.env.QR_SCAN_HASH_SECRET) ||
    cleanSecret(process.env.INTEGRATION_SECRET_KEY) ||
    cleanSecret(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    "dev-only-qr-scan-hash-secret"
  );
}

export function hashIpForQrScan(ip: string): string {
  return createHmac("sha256", getQrScanHashSecret())
    .update(ip.trim().toLowerCase())
    .digest("hex");
}

export function generateShortCode(bytes = 9): string {
  // URL-safe, hard to guess (~12 chars)
  return randomBytes(bytes).toString("base64url").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12);
}

export function generateClaimToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashClaimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function claimTokensMatch(a: string, b: string): boolean {
  const ha = Buffer.from(hashClaimToken(a));
  const hb = Buffer.from(hashClaimToken(b));
  if (ha.length !== hb.length) return false;
  return timingSafeEqual(ha, hb);
}

/** Strict Google review / GBP review destinations for QR campaigns. */
const GOOGLE_HOSTS = new Set([
  "search.google.com",
  "www.google.com",
  "google.com",
  "g.page",
  "maps.app.goo.gl",
  "maps.google.com",
  "business.google.com",
]);

export function isAllowedQrDestination(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase();
  if (GOOGLE_HOSTS.has(host)) return true;
  if (host.endsWith(".google.com") || host.endsWith(".g.page") || host.endsWith(".goo.gl")) {
    return true;
  }
  // Accept writereview-style paths on google hosts only (already covered).
  return false;
}

export function assertAllowedQrDestination(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!isAllowedQrDestination(trimmed)) {
    throw new Error(
      "Destination must be a valid Google review URL (search.google.com/local/writereview or Google Maps review link)."
    );
  }
  return trimmed;
}
