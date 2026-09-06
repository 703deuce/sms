import { NextResponse } from "next/server";
import { handleMicrosoftCalendarLifecycleWebhook } from "@/lib/calendar/webhooks";

export async function GET(request: Request) {
  const validationToken = new URL(request.url).searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const validationToken = new URL(request.url).searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const body = await request.json();
    const notifications = (body.value || []) as Array<Record<string, unknown>>;
    await handleMicrosoftCalendarLifecycleWebhook(
      notifications.map((n) => ({
        subscriptionId: n.subscriptionId as string | undefined,
        clientState: n.clientState as string | undefined,
        lifecycleEvent: n.lifecycleEvent as string | undefined,
      })),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn("[calendar] microsoft lifecycle webhook error", err);
    return NextResponse.json({ ok: true });
  }
}
