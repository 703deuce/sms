import { NextResponse } from "next/server";
import { handleMicrosoftCalendarWebhook } from "@/lib/calendar/webhooks";

export async function GET(request: Request) {
  const validationToken = new URL(request.url).searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const validationToken = new URL(request.url).searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  try {
    const body = await request.json();
    const notifications = (body.value || []) as Array<Record<string, unknown>>;
    await handleMicrosoftCalendarWebhook(
      notifications.map((n) => ({
        subscriptionId: n.subscriptionId as string | undefined,
        clientState: n.clientState as string | undefined,
        changeType: n.changeType as string | undefined,
        resource: n.resource as string | undefined,
        resourceData: n.resourceData as { id?: string } | undefined,
      })),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn("[calendar] microsoft webhook error", err);
    return NextResponse.json({ ok: true });
  }
}
