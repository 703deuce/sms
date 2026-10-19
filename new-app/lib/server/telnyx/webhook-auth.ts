import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { phoneServerLog } from "@/lib/server/phone/phone-log";

/** Telnyx portal often supplies a raw base64 32-byte Ed25519 key, not PEM/SPKI. */
function buildTelnyxPublicKey(publicKey: string): crypto.KeyObject {
  const trimmed = publicKey.trim();
  if (trimmed.includes("BEGIN PUBLIC KEY")) {
    return crypto.createPublicKey(trimmed);
  }
  const raw = Buffer.from(trimmed, "base64");
  if (raw.length === 32) {
    const derPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const der = Buffer.concat([derPrefix, raw]);
    return crypto.createPublicKey({ key: der, format: "der", type: "spki" });
  }
  return crypto.createPublicKey(trimmed);
}

export function telnyxEventType(payload: unknown): string {
  const root = (payload || {}) as Record<string, unknown>;
  const data = root.data as Record<string, unknown> | undefined;
  return String(data?.event_type || root.event_type || "").toLowerCase();
}

export function telnyxEventId(payload: unknown): string {
  const root = (payload || {}) as Record<string, unknown>;
  const data = root.data as Record<string, unknown> | undefined;
  return String(data?.id || root.id || "");
}

/** Ed25519 verify when TELNYX_PUBLIC_KEY is set; otherwise allow only if no key configured. */
export async function readTelnyxWebhook(request: Request): Promise<
  | { ok: true; rawBody: string; payload: unknown }
  | { ok: false; response: NextResponse }
> {
  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    phoneServerLog("webhook-auth", "reject_invalid_json");
    return { ok: false, response: new NextResponse("Invalid JSON", { status: 400 }) };
  }

  const publicKey = process.env.TELNYX_PUBLIC_KEY?.trim();
  if (!publicKey) {
    phoneServerLog("webhook-auth", "accept_unsigned", { bodyBytes: rawBody.length });
    return { ok: true, rawBody, payload };
  }

  const signature =
    request.headers.get("telnyx-signature-ed25519") ||
    request.headers.get("x-telnyx-signature");
  const timestamp =
    request.headers.get("telnyx-timestamp") || request.headers.get("x-telnyx-timestamp");

  if (!signature || !timestamp) {
    phoneServerLog("webhook-auth", "reject_missing_signature", {
      hasSignature: Boolean(signature),
      hasTimestamp: Boolean(timestamp),
    });
    return { ok: false, response: new NextResponse("Missing signature", { status: 403 }) };
  }

  const signed = `${timestamp}|${rawBody}`;
  try {
    const key = buildTelnyxPublicKey(publicKey);
    const ok = crypto.verify(
      null,
      Buffer.from(signed),
      key,
      Buffer.from(signature, "base64"),
    );
    if (!ok) {
      phoneServerLog("webhook-auth", "reject_invalid_signature");
      return { ok: false, response: new NextResponse("Invalid signature", { status: 403 }) };
    }
  } catch (err) {
    phoneServerLog("webhook-auth", "reject_signature_verify_error", {
      error: err instanceof Error ? err.message : "verify_failed",
    });
    return { ok: false, response: new NextResponse("Invalid signature", { status: 403 }) };
  }

  phoneServerLog("webhook-auth", "accept_signed", { bodyBytes: rawBody.length });
  return { ok: true, rawBody, payload };
}
