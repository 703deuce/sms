/**
 * Stateless one-time-code helpers for SMS phone verification (opt-in).
 *
 * The code is never stored in the database. Instead we store an HMAC-signed
 * token (hash of the code + phone + expiry) in an httpOnly cookie, so the flow
 * works without a DB write and cannot be tampered with client-side.
 */
import crypto from "crypto";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export { SMS_OPT_IN_DISCLOSURE, smsOtpMessage } from "@/lib/auth/sms-opt-in-copy";

export const PHONE_OTP_COOKIE = "transovo_phone_otp";
export const PHONE_VERIFIED_COOKIE = "transovo_phone_verified";
export const OTP_TTL_SECONDS = 600;

type OtpPayload = { p: string; c: string; exp: number };

function signingSecret(): string {
  return (
    process.env.CRON_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "transovo-dev-otp-secret"
  );
}

function sign(value: string): string {
  return crypto.createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

function hashCode(phone: string, code: string): string {
  return crypto.createHmac("sha256", signingSecret()).update(`${phone}:${code}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function normalizePhone(input: string): string {
  return normalizeE164(input);
}

export function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function createOtpToken(phone: string, code: string): string {
  const payload: OtpPayload = {
    p: phone,
    c: hashCode(phone, code),
    exp: Date.now() + OTP_TTL_SECONDS * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export type OtpVerifyResult = { ok: true } | { ok: false; reason: string };

export function verifyOtpToken(
  token: string | undefined,
  phone: string,
  code: string,
): OtpVerifyResult {
  if (!token) return { ok: false, reason: "missing" };
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, reason: "malformed" };
  if (!safeEqual(sig, sign(body))) return { ok: false, reason: "bad_signature" };

  let payload: OtpPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString()) as OtpPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (Date.now() > payload.exp) return { ok: false, reason: "expired" };
  if (payload.p !== phone) return { ok: false, reason: "phone_mismatch" };
  if (!safeEqual(payload.c, hashCode(phone, code))) return { ok: false, reason: "bad_code" };
  return { ok: true };
}

export function createVerifiedToken(phone: string): string {
  const body = Buffer.from(JSON.stringify({ p: phone, t: Date.now() })).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Returns the E.164 phone from a verified cookie, or null if invalid/expired. */
export function readVerifiedPhone(token: string | undefined, maxAgeMs = 60 * 60 * 24 * 30 * 1000): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sig, sign(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as { p?: string; t?: number };
    if (!payload.p || typeof payload.t !== "number") return null;
    if (Date.now() - payload.t > maxAgeMs) return null;
    return payload.p;
  } catch {
    return null;
  }
}
