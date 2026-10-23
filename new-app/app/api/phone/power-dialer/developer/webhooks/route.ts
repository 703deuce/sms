import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { requirePowerDialerScope } from "@/lib/server/phone/power-dialer/power-dialer-permissions";
import { getPrisma } from "@/lib/server/db";
import {
  createPowerDialerWebhookEndpoint,
  replayPowerDialerWebhookDelivery,
  sendTestWebhook,
} from "@/lib/server/phone/power-dialer/webhooks/delivery";
import type { PowerDialerWebhookEventType } from "@/lib/server/phone/power-dialer/webhooks/events";
import { POWER_DIALER_WEBHOOK_EVENTS } from "@/lib/server/phone/power-dialer/webhooks/events";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    await requirePowerDialerScope(workspaceId, await resolveInternalUserId(), "settings_write");
    const prisma = getPrisma();
    const endpoints = await prisma.powerDialerWebhookEndpoint.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    const deliveries = await prisma.powerDialerWebhookDelivery.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { endpoint: { select: { name: true, url: true } } },
    });
    return NextResponse.json({ data: { endpoints, deliveries, catalog: POWER_DIALER_WEBHOOK_EVENTS } });
  } catch (err) {
    return jsonError(err, 403);
  }
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    await requirePowerDialerScope(workspaceId, await resolveInternalUserId(), "settings_write");
    const body = (await request.json()) as {
      action?: string;
      name?: string;
      url?: string;
      events?: PowerDialerWebhookEventType[];
      id?: string;
      active?: boolean;
      deliveryId?: string;
    };
    const prisma = getPrisma();
    if (body.action === "test" && body.id) {
      const r = await sendTestWebhook(workspaceId, body.id);
      return NextResponse.json({ ok: true, delivered: r.ok });
    }
    if (body.action === "replay" && body.deliveryId) {
      const r = await replayPowerDialerWebhookDelivery(workspaceId, body.deliveryId);
      return NextResponse.json({ ok: true, delivered: r.ok });
    }
    if (body.action === "toggle" && body.id) {
      await prisma.powerDialerWebhookEndpoint.updateMany({
        where: { id: body.id, workspaceId },
        data: { active: Boolean(body.active) },
      });
      return NextResponse.json({ ok: true });
    }
    if (!body.url || !body.events?.length) throw new Error("url and events required");
    const { endpoint, signingSecret } = await createPowerDialerWebhookEndpoint({
      workspaceId,
      name: body.name || "Webhook",
      url: body.url,
      events: body.events,
    });
    return NextResponse.json({ data: { endpoint, signingSecret } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
