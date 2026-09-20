import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SCRYPT_SALT_LEN = 16;

export function generateWebhookSigningSecret(): { secret: string; prefix: string; hash: string } {
  const secret = `whsec_${randomBytes(24).toString("hex")}`;
  const prefix = secret.slice(0, 12);
  const salt = randomBytes(SCRYPT_SALT_LEN);
  const hash = scryptSync(secret, salt, 32).toString("hex");
  const stored = `${salt.toString("hex")}:${hash}`;
  return { secret, prefix, hash: stored };
}

export function verifyWebhookSigningSecret(secret: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = scryptSync(secret, salt, 32);
  const actual = Buffer.from(hashHex, "hex");
  try {
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function signWebhookPayload(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}
