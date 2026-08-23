import { createHash, randomBytes } from "crypto";

export function generateShareToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}
