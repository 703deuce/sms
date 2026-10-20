/**
 * Encrypt CRM OAuth tokens at rest using INTEGRATION_SECRET_KEY.
 * Format: enc:v1:<iv_hex>:<tag_hex>:<cipher_hex>
 * Plain tokens are still accepted for backward compatibility / migration.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function keyBytes() {
  const secret = process.env.INTEGRATION_SECRET_KEY?.trim();
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

export function encryptCrmSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith(PREFIX)) return value;
  const key = keyBytes();
  if (!key) return value; // no key yet — store as-is (env-check flags this)
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptCrmSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value;
  const key = keyBytes();
  if (!key) throw new Error("INTEGRATION_SECRET_KEY required to decrypt CRM tokens");
  const body = value.slice(PREFIX.length);
  const [ivHex, tagHex, dataHex] = body.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Corrupt encrypted CRM token");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
