import { timingSafeEqual } from "crypto";

/** Constant-time compare for UTF-8 secrets of equal length. */
export function safeEqualSecret(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Authorize a cron/internal Bearer secret from the Authorization header only.
 * Query-string tokens are never accepted.
 */
export function authorizeBearerSecret(
  request: Request,
  secret: string | undefined | null,
  options?: { allowMissingInDev?: boolean }
): { ok: true } | { ok: false; status: 401 | 503; error: string } {
  const expected = secret?.trim() ?? "";
  const allowMissing = options?.allowMissingInDev !== false;
  if (!expected) {
    if (process.env.NODE_ENV === "production" || !allowMissing) {
      return { ok: false, status: 503, error: "Secret is not configured" };
    }
    return { ok: true };
  }

  const header = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const presented = match?.[1]?.trim() ?? "";
  if (!presented || !safeEqualSecret(presented, expected)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}

/**
 * Authorize a webhook shared secret from headers only (no query tokens).
 * Accepts `x-*-token`, `x-webhook-secret`, or `Authorization: Bearer`.
 */
export function authorizeHeaderSecret(
  request: Request,
  secret: string | undefined | null,
  options?: {
    allowMissingInDev?: boolean;
    headerNames?: string[];
  }
): { ok: true } | { ok: false; status: 401 | 503; error: string } {
  const expected = secret?.trim() ?? "";
  const allowMissing = options?.allowMissingInDev !== false;
  if (!expected) {
    if (process.env.NODE_ENV === "production" || !allowMissing) {
      return { ok: false, status: 503, error: "Secret is not configured" };
    }
    return { ok: true };
  }

  const names = options?.headerNames ?? [
    "x-webhook-secret",
    "x-brevo-token",
    "x-webhook-token",
    "authorization",
  ];

  for (const name of names) {
    const raw = request.headers.get(name)?.trim() ?? "";
    if (!raw) continue;
    const value = name.toLowerCase() === "authorization"
      ? raw.replace(/^Bearer\s+/i, "").trim()
      : raw;
    if (safeEqualSecret(value, expected)) return { ok: true };
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}
