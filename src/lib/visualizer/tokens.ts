import { createHash, randomBytes } from "crypto";

export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function generatePublicKey(): string {
  return randomBytes(16).toString("hex");
}
