import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { realtimeBridgeSigningSecret } from "./config";

export type RealtimeBridgeStreamClaims = {
  callId: string;
  workspaceId: string;
  agentId: string;
  callControlId: string;
  exp: number;
};

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function mintRealtimeBridgeStreamToken(input: {
  callId: string;
  workspaceId: string;
  agentId: string;
  callControlId: string;
  ttlSeconds?: number;
}): string {
  const secret = realtimeBridgeSigningSecret();
  if (!secret) {
    throw new Error("VOICE_REALTIME_BRIDGE_SIGNING_SECRET (or fallback secret) required");
  }
  const exp = Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 600);
  const nonce = b64url(randomBytes(12));
  const body = JSON.stringify({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callControlId: input.callControlId,
    exp,
    nonce,
  });
  const bodyB64 = b64url(Buffer.from(body, "utf8"));
  const sig = signPayload(bodyB64, secret);
  return `${bodyB64}.${sig}`;
}

export function verifyRealtimeBridgeStreamToken(
  token: string,
): RealtimeBridgeStreamClaims | null {
  const secret = realtimeBridgeSigningSecret();
  if (!secret || !token.includes(".")) return null;
  const [bodyB64, sig] = token.split(".", 2);
  if (!bodyB64 || !sig) return null;
  const expected = signPayload(bodyB64, secret);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const json = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8")) as RealtimeBridgeStreamClaims & {
      nonce?: string;
    };
    if (!json.callId || !json.workspaceId || !json.agentId || !json.callControlId) return null;
    if (typeof json.exp !== "number" || json.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      callId: json.callId,
      workspaceId: json.workspaceId,
      agentId: json.agentId,
      callControlId: json.callControlId,
      exp: json.exp,
    };
  } catch {
    return null;
  }
}
