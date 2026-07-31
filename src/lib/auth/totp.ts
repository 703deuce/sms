import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import { BRAND_NAME } from "@/lib/brand";

/**
 * Two-factor (TOTP) helpers.
 *
 * The shared secret is stored encrypted at rest using AES-256-GCM with a key
 * derived from NEXTAUTH_SECRET / APP_SECRET. Backup codes are stored as
 * salted SHA-256 hashes so they are single-use and never persisted in plain text.
 */

const ENC_PREFIX = "v1:";

function encryptionKey(): Buffer {
  const secret =
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.APP_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "transovo-dev-totp-secret";
  return createHash("sha256").update(secret).digest();
}

/** AES-256-GCM encrypt a TOTP secret for storage. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/** Reverse {@link encryptSecret}. Returns null when the payload is unreadable. */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    if (!payload.startsWith(ENC_PREFIX)) {
      // Legacy/plain fallback: treat the stored value as the raw secret.
      return payload;
    }
    const [, ivB64, tagB64, dataB64] = payload.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

export function generateTotpSecret(): string {
  return generateSecret();
}

export function buildOtpAuthUrl(secret: string, accountEmail: string): string {
  return generateURI({
    secret,
    label: accountEmail,
    issuer: BRAND_NAME,
  });
}

/** Verify a 6-digit TOTP token, allowing a small clock-drift window. */
export function verifyTotp(token: string, secret: string): boolean {
  const code = (token || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  try {
    const result = verifySync({ token: code, secret, epochTolerance: 30 });
    return Boolean(result?.valid);
  } catch {
    return false;
  }
}

function hashBackupCode(code: string): string {
  return createHash("sha256")
    .update(`${encryptionKey().toString("hex")}:${code.toUpperCase()}`)
    .digest("hex");
}

/** Generate N formatted backup codes plus their stored hashes. */
export function generateBackupCodes(count = 10): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = Array.from({ length: 10 }, () => randomInt(0, 36).toString(36)).join("").toUpperCase();
    const formatted = `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
    codes.push(formatted);
    hashes.push(hashBackupCode(formatted));
  }
  return { codes, hashes };
}

/**
 * Check a backup code against stored hashes. Returns the remaining hashes
 * (with the consumed one removed) when valid, or null when not.
 */
export function consumeBackupCode(input: string, stored: string[]): string[] | null {
  const normalized = (input || "").trim().toUpperCase();
  if (!normalized) return null;
  const hash = hashBackupCode(normalized);
  if (!stored.includes(hash)) return null;
  return stored.filter((h) => h !== hash);
}
