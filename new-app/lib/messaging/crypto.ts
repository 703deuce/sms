import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function getKey() {
  const secret = process.env.INTEGRATION_SECRET_KEY?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production" || process.env.TWILIO_MODE === "live") {
      throw new Error("INTEGRATION_SECRET_KEY is required to encrypt integration secrets");
    }
    return createHash("sha256").update("transovo-dev-insecure-key").digest();
  }
  return createHash("sha256").update(secret).digest();
}

/** Encrypt a secret string for at-rest storage (AES-256-GCM). Returns `iv:tag:ciphertext` hex. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Invalid encrypted secret payload");
  }
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return dec.toString("utf8");
}

export function randomTrackingToken() {
  return randomBytes(16).toString("hex");
}
