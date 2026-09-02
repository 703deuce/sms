import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapConversation } from "@/lib/mappers";
import {
  buildConversationWhere,
  parseInboxSearchParams,
} from "@/lib/mass-texting/inbox-filters";
import { prismaProductSourceToApp, productSourceLabel } from "@/lib/mass-texting/product-source";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const filters = parseInboxSearchParams(searchParams);
    const where = buildConversationWhere(auth.workspaceId, filters, auth.session.userId);

    const data = await getPrisma().conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 250,
      include: {
        contact: true,
        assignee: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const campaignIds = [...new Set(data.map((c: (typeof data)[number]) => c.campaignId).filter(Boolean))] as string[];
    const campaigns =
      campaignIds.length > 0
        ? await getPrisma().campaign.findMany({
            where: { workspaceId: auth.workspaceId, id: { in: campaignIds } },
            select: { id: true, name: true },
          })
        : [];
    const campaignNames = new Map(campaigns.map((c: (typeof campaigns)[number]) => [c.id, c.name]));

    return NextResponse.json({
      data: data.map((c: (typeof data)[number]) => {
        const productSource = prismaProductSourceToApp(c.productSource);
        return {
          id: c.id,
          status: c.status,
          unread: c.unread,
          assignedTo: c.assignee?.name || null,
          productSource,
          productSourceLabel: productSource ? productSourceLabel(productSource) : null,
          phoneNumberId: c.phoneNumberId,
          fromE164: c.fromE164,
          campaignId: c.campaignId,
          campaignName: c.campaignId ? campaignNames.get(c.campaignId) || null : null,
          contact: c.contact
            ? {
                id: c.contact.id,
                phone: c.contact.phone,
                firstName: c.contact.firstName,
                lastName: c.contact.lastName,
              }
            : null,
          lastMessage: c.messages[0]?.body || "",
          updatedAt: c.updatedAt,
          tags: c.tags || [],
        };
      }),
      filters,
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
