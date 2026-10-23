import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi } from "@/lib/server/phone/power-dialer/public-api/http";
import { createPowerDialerWebhookEndpoint } from "@/lib/server/phone/power-dialer/webhooks/delivery";
import type { PowerDialerWebhookEventType } from "@/lib/server/phone/power-dialer/webhooks/events";

export async function POST(request: Request) {
  return withPublicApi(request, "webhooks:manage", async (ctx) => {
    const body = (await request.json()) as { hookUrl?: string; event?: string };
    if (!body.hookUrl || !body.event) {
      return NextResponse.json(
        { error: { code: "validation", message: "hookUrl and event required" } },
        { status: 400 },
      );
    }
    const { endpoint } = await createPowerDialerWebhookEndpoint({
      workspaceId: ctx.workspaceId,
      name: `Zapier ${body.event}`,
      url: body.hookUrl,
      events: [body.event as PowerDialerWebhookEventType],
    });
    return NextResponse.json({ id: endpoint.id, event: body.event });
  });
}

export async function DELETE(request: Request) {
  return withPublicApi(request, "webhooks:manage", async (ctx) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: { code: "validation", message: "id required" } }, { status: 400 });
    }
    const prisma = getPrisma();
    await prisma.powerDialerWebhookEndpoint.updateMany({
      where: { id, workspaceId: ctx.workspaceId },
      data: { active: false },
    });
    return NextResponse.json({ ok: true });
  });
}
