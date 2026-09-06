import { NextResponse } from "next/server";
import { handleGoogleCalendarWebhook } from "@/lib/calendar/webhooks";

export async function POST(request: Request) {
  const channelId = request.headers.get("x-goog-channel-id") || undefined;
  const resourceId = request.headers.get("x-goog-resource-id") || undefined;
  const resourceState = request.headers.get("x-goog-resource-state") || undefined;
  const channelToken = request.headers.get("x-goog-channel-token") || undefined;

  try {
    await handleGoogleCalendarWebhook({
      channelId,
      resourceId,
      resourceState,
      channelToken,
    });
  } catch (err) {
    console.warn("[calendar] google webhook error", err);
  }

  return NextResponse.json({ ok: true });
}
