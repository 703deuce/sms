import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { formatMessagePreview } from "@/lib/inbox/message-preview";
import {
  decodeInboxCursor,
  encodeInboxCursor,
  parseInboxTake,
} from "@/lib/inbox/inbox-pagination";
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
    const take = parseInboxTake(searchParams.get("take"));
    const baseWhere = buildConversationWhere(auth.workspaceId, filters, auth.session.userId);
    const cursor = decodeInboxCursor(filters.cursor);

    const cursorFilter = cursor
      ? {
          OR: [
            { updatedAt: { lt: new Date(cursor.updatedAt) } },
            { updatedAt: new Date(cursor.updatedAt), id: { lt: cursor.id } },
          ],
        }
      : null;

    const data = await getPrisma().conversation.findMany({
      where: cursorFilter ? { AND: [baseWhere, cursorFilter] } : baseWhere,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: take + 1,
      include: {
        contact: true,
        assignee: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const hasMore = data.length > take;
    const page = hasMore ? data.slice(0, take) : data;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeInboxCursor({ updatedAt: new Date(last.updatedAt).toISOString(), id: last.id })
        : null;

    const campaignIds = [...new Set(page.map((c: (typeof page)[number]) => c.campaignId).filter(Boolean))] as string[];
    const campaigns =
      campaignIds.length > 0
        ? await getPrisma().campaign.findMany({
            where: { workspaceId: auth.workspaceId, id: { in: campaignIds } },
            select: { id: true, name: true },
          })
        : [];
    const campaignNames = new Map(campaigns.map((c: (typeof campaigns)[number]) => [c.id, c.name]));

    return NextResponse.json({
      data: page.map((c: (typeof page)[number]) => {
        const productSource = prismaProductSourceToApp(c.productSource);
        const lastMsg = c.messages[0];
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
          lastMessage: lastMsg
            ? formatMessagePreview({
                body: lastMsg.body,
                mediaUrls: lastMsg.mediaUrls,
                direction: lastMsg.direction,
              })
            : "",
          updatedAt: c.updatedAt,
          tags: c.tags || [],
        };
      }),
      filters,
      pagination: {
        take,
        hasMore,
        nextCursor,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
