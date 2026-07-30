/**
 * Always verify Telnyx webhooks with the Telnyx provider (never mock/twilio).
 */

import { NextResponse } from "next/server";
import { telnyxProvider } from "./provider";
import { getTelnyxApiKey, getTelnyxPublicKey } from "./config";

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

  const signature =
    request.headers.get("telnyx-signature-ed25519") ||
    request.headers.get("x-telnyx-signature") ||
    request.headers.get("telnyx-signature");
  const timestamp =
    request.headers.get("telnyx-timestamp") || request.headers.get("x-telnyx-timestamp");

  const verified = await telnyxProvider.verifyWebhook({
    payload: rawBody,
    signature,
    timestamp,
    headers: request.headers,
  });

  const mustVerify = Boolean(getTelnyxPublicKey() || getTelnyxApiKey());
  if (!verified && mustVerify) {
    if (process.env.NODE_ENV === "production" || getTelnyxPublicKey()) {
      return { ok: false, response: new NextResponse("Invalid signature", { status: 403 }) };
    }
  }

  return { ok: true, rawBody, payload };
}

export function telnyxEventType(payload: unknown): string {
  const root = (payload || {}) as Record<string, any>;
  return String(root?.data?.event_type || root?.event_type || "").toLowerCase();
}
