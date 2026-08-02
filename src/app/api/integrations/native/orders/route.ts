import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getActionCapabilityTruth } from "@/lib/integrations/framework/capability-truth";
import { isExternalProvider } from "@/lib/integrations/framework";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import type { IntegrationActionId } from "@/lib/integrations/framework/actions-registry";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();

    const rows = await prisma.integrationOrder.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const orders = await Promise.all(
      (
        rows as Array<{
          id: string;
          provider: string;
          externalId: string;
          contactId: string | null;
          orderNumber: string | null;
          status: string | null;
          total: string | null;
          currency: string | null;
          customerName: string | null;
          customerEmail: string | null;
          customerPhone: string | null;
          paidAt: Date | null;
          completedAt: Date | null;
          createdExternalAt: Date | null;
          externalUrl: string | null;
          lineItemsJson: unknown;
          shippingJson: unknown;
          syncStatus: string;
        }>
      ).map(async (o) => {
        const contactId = o.contactId;
        let relatedCalls = 0;
        let relatedSms = 0;
        let tickets = 0;
        let automations = 0;
        if (contactId) {
          relatedCalls = await prisma.humanCall.count({
            where: { workspaceId: auth.workspaceId, contactId },
          });
          relatedSms = await prisma.conversation.count({
            where: { workspaceId: auth.workspaceId, contactId },
          });
          tickets = await prisma.crmObjectMapping.count({
            where: {
              workspaceId: auth.workspaceId,
              internalId: contactId,
              objectType: "support_ticket",
            },
          });
          automations = await prisma.integrationActionLog.count({
            where: { workspaceId: auth.workspaceId, contactId, source: "automation" },
          });
        }

        const provider = o.provider;
        const canNote =
          isExternalProvider(provider) &&
          getActionCapabilityTruth(provider, "order.add_note").supported;
        const canTicket =
          isExternalProvider(provider) &&
          getActionCapabilityTruth(provider, "ticket.create").supported;

        return {
          id: o.id,
          provider: o.provider,
          externalId: o.externalId,
          orderNumber: o.orderNumber,
          status: o.status,
          total: o.total,
          currency: o.currency,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone,
          contactId,
          paidAt: o.paidAt?.toISOString() || null,
          completedAt: o.completedAt?.toISOString() || null,
          createdAt: o.createdExternalAt?.toISOString() || null,
          products: o.lineItemsJson || [],
          shipping: o.shippingJson || null,
          providerUrl: o.externalUrl,
          syncStatus: o.syncStatus,
          relatedCalls,
          relatedSms,
          supportTickets: tickets,
          automationHistory: automations,
          safeActions: {
            openProvider: Boolean(o.externalUrl),
            sendSms: Boolean(contactId || o.customerPhone),
            call: Boolean(contactId || o.customerPhone),
            addOrderNote: canNote,
            createSupportTicket: canTicket,
            addInternalNote: Boolean(contactId),
            refund: false,
            paymentChange: false,
            priceChange: false,
            inventoryChange: false,
            fulfillmentChange: false,
          },
        };
      }),
    );

    return NextResponse.json({ data: { orders } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      action?: IntegrationActionId | "internal_note";
      provider?: string;
      orderId?: string;
      note?: string;
      contactId?: string | null;
      params?: Record<string, unknown>;
    };

    if (body.action === "internal_note" && body.contactId && body.note) {
      await getPrisma().auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          userId: auth.session.userId,
          event: "order.internal_note",
          detail: JSON.stringify({ note: body.note, orderId: body.orderId, contactId: body.contactId }),
        },
      });
      return NextResponse.json({ data: { ok: true } });
    }

    const provider = String(body.provider || "");
    const actionId = (body.action || "order.add_note") as IntegrationActionId;
    if (!isExternalProvider(provider)) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }
    if (
      ["refund", "payment", "price", "inventory", "fulfillment"].some((x) =>
        String(actionId).includes(x),
      )
    ) {
      return NextResponse.json(
        { error: "This commerce action is intentionally unsupported." },
        { status: 400 },
      );
    }

    const truth = getActionCapabilityTruth(provider, actionId);
    if (!truth.supported) {
      return NextResponse.json({ error: truth.reason }, { status: 400 });
    }

    await enqueueJob({
      jobType: "integration_action",
      queueName: `ext-${provider}`,
      workspaceId: auth.workspaceId,
      priority: 25,
      payload: JSON.parse(
        JSON.stringify({
          workspaceId: auth.workspaceId,
          provider,
          actionId,
          params: body.params || {
            orderId: body.orderId,
            note: body.note,
          },
          contactId: body.contactId || null,
          actorUserId: auth.session.userId,
          source: "human",
        }),
      ),
    });

    return NextResponse.json({ data: { queued: true } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
