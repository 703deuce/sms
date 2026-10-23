import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi } from "@/lib/server/phone/power-dialer/public-api/http";
import {
  createPowerDialerWebhookEndpoint,
  sendTestWebhook,
} from "@/lib/server/phone/power-dialer/webhooks/delivery";
import type { PowerDialerWebhookEventType } from "@/lib/server/phone/power-dialer/webhooks/events";
import { POWER_DIALER_WEBHOOK_EVENTS } from "@/lib/server/phone/power-dialer/webhooks/events";

export async function GET(request: Request) {
  return withPublicApi(request, "webhooks:manage", async (ctx) => {
      const prisma = getPrisma();
      const rows = await prisma.powerDialerWebhookEndpoint.findMany({
        where: { workspaceId: ctx.workspaceId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          url: true,
          events: true,
          active: true,
          signingSecretPrefix: true,
          createdAt: true,
        },
      });
      return NextResponse.json({ data: rows, catalog: POWER_DIALER_WEBHOOK_EVENTS });
    },
  );
}

export async function POST(request: Request) {
  return withPublicApi(request, "webhooks:manage", async (ctx) => {
    const body = (await request.json()) as {
      name?: string;
      url?: string;
      events?: PowerDialerWebhookEventType[];
      test?: boolean;
      endpointId?: string;
    };
    if (body.test && body.endpointId) {
      const result = await sendTestWebhook(ctx.workspaceId, body.endpointId);
      return NextResponse.json({ ok: true, delivered: result.ok });
    }
    if (!body.url || !body.events?.length) {
      return NextResponse.json(
        { error: { code: "validation", message: "url and events required" } },
        { status: 400 },
      );
    }
    const { endpoint, signingSecret } = await createPowerDialerWebhookEndpoint({
      workspaceId: ctx.workspaceId,
      name: body.name || "API webhook",
      url: body.url,
      events: body.events,
    });
    return NextResponse.json({
      data: {
        id: endpoint.id,
        signingSecret,
        prefix: endpoint.signingSecretPrefix,
      },
    });
  });
}

export async function PATCH(request: Request) {
  return withPublicApi(request, "webhooks:manage", async (ctx) => {
    const body = (await request.json()) as { id?: string; active?: boolean; name?: string };
    if (!body.id) {
      return NextResponse.json({ error: { code: "validation", message: "id required" } }, { status: 400 });
    }
    const prisma = getPrisma();
    await prisma.powerDialerWebhookEndpoint.updateMany({
      where: { id: body.id, workspaceId: ctx.workspaceId },
      data: {
        active: typeof body.active === "boolean" ? body.active : undefined,
        name: body.name?.trim() || undefined,
      },
    });
    return NextResponse.json({ ok: true });
  });
}
