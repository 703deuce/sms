import { timingSafeEqual } from "node:crypto";

export function voiceRuntimeInternalSecret(): string | null {
  const primary = process.env.TRANSOVO_INTERNAL_API_KEY?.trim();
  if (primary) return primary;
  const explicit = process.env.VOICE_RUNTIME_INTERNAL_SECRET?.trim();
  if (explicit) return explicit;
  const integration = process.env.INTEGRATION_SECRET_KEY?.trim();
  if (integration) return integration;
  return null;
}

export function verifyVoiceRuntimeInternalAuth(header: string | null): boolean {
  const secret = voiceRuntimeInternalSecret();
  if (!secret) return false;
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length).trim();
  if (!token || token.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}
