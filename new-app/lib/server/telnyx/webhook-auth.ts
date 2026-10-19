import { NextResponse } from "next/server";
import crypto from "node:crypto";

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
    return { ok: false, response: new NextResponse("Invalid JSON", { status: 400 }) };
  }

  const publicKey = process.env.TELNYX_PUBLIC_KEY?.trim();
  if (!publicKey) {
    return { ok: true, rawBody, payload };
  }

  const signature =
    request.headers.get("telnyx-signature-ed25519") ||
    request.headers.get("x-telnyx-signature");
  const timestamp =
    request.headers.get("telnyx-timestamp") || request.headers.get("x-telnyx-timestamp");

  if (!signature || !timestamp) {
    return { ok: false, response: new NextResponse("Missing signature", { status: 403 }) };
  }

  const signed = `${timestamp}|${rawBody}`;
  try {
    const key = publicKey.includes("BEGIN PUBLIC KEY")
      ? crypto.createPublicKey(publicKey)
      : crypto.createPublicKey({
          key: Buffer.from(publicKey, "base64"),
          format: "der",
          type: "spki",
        });
    const ok = crypto.verify(
      null,
      Buffer.from(signed),
      key,
      Buffer.from(signature, "base64"),
    );
    if (!ok) {
      return { ok: false, response: new NextResponse("Invalid signature", { status: 403 }) };
    }
  } catch {
    return { ok: false, response: new NextResponse("Invalid signature", { status: 403 }) };
  }

  return { ok: true, rawBody, payload };
}
