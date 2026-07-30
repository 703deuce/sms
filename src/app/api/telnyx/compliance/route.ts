import { NextResponse } from "next/server";
import { readTelnyxWebhook } from "@/lib/messaging/telnyx/webhook-auth";
import { handleTelnyxCompliance } from "@/lib/messaging/telnyx/webhook-handlers";

/**
 * Telnyx 10DLC / brand / campaign event notifications.
 * Re-enqueues registration advance for the matching workspace.
 */
export async function POST(request: Request) {
  try {
    const verified = await readTelnyxWebhook(request);
    if (!verified.ok) return verified.response;

    const result = await handleTelnyxCompliance(verified.payload);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[telnyx/compliance]", err);
    return new NextResponse("Compliance webhook failed", { status: 500 });
  }
}
