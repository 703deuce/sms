import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma, type DbRow } from "@/lib/db";
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
import { assertInboxEnabled } from "@/lib/inbox/inbox-access";
import { loadUpcomingAppointmentsByContactIds } from "@/lib/appointments/analytics";

function formatAppointmentContextLabel(serviceName: string | null, startsAt: Date) {
  const when = startsAt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${serviceName || "Appointment"} — ${when}`;
}

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertInboxEnabled(auth.workspaceId);
    const prisma = getPrisma();
    const { searchParams } = new URL(request.url);
    const filters = parseInboxSearchParams(searchParams);
    const take = parseInboxTake(searchParams.get("take"));
    let baseWhere = buildConversationWhere(auth.workspaceId, filters, auth.session.userId);

    if (filters.filter === "appointments") {
      const apptRows = await prisma.voiceAppointment.findMany({
        where: {
          workspaceId: auth.workspaceId,
          startsAt: { gte: new Date() },
          status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
          contactId: { not: null },
        },
        select: { contactId: true },
        distinct: ["contactId"],
        take: 500,
      });
      const contactIds = apptRows.map((r: DbRow) => r.contactId).filter(Boolean) as string[];
      baseWhere = { AND: [baseWhere, { contactId: { in: contactIds.length ? contactIds : ["__none__"] } }] };
    }

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
        missedCallEvent: { select: { detectedAt: true } },
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

    const contactIds = [
      ...new Set(page.map((c: DbRow) => c.contactId).filter(Boolean)),
    ] as string[];
    const appointmentByContact = await loadUpcomingAppointmentsByContactIds(
      auth.workspaceId,
      contactIds,
    );

    return NextResponse.json({
      data: page.map((c: (typeof page)[number]) => {
        const productSource = prismaProductSourceToApp(c.productSource);
        const lastMsg = c.messages[0];
        const appt = c.contactId ? appointmentByContact.get(c.contactId) : undefined;
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
          missedCallEventId: c.missedCallEventId ?? null,
          missedCallDetectedAt: c.missedCallEvent?.detectedAt
            ? c.missedCallEvent.detectedAt.toISOString()
            : null,
          appointmentContext: appt
            ? {
                id: appt.id,
                serviceName: appt.serviceName,
                startsAt: appt.startsAt.toISOString(),
                label: formatAppointmentContextLabel(appt.serviceName, appt.startsAt),
              }
            : null,
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
