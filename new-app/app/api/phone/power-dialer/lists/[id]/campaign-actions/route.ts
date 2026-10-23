import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { addContactsToList } from "@/lib/server/phone/power-dialer/list-members";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id: sourceListId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { campaignId?: string; contactIds?: string[] };
    const campaignId = body.campaignId?.trim();
    const contactIds = Array.isArray(body.contactIds) ? body.contactIds.filter(Boolean) : [];
    if (!campaignId || !contactIds.length) throw new Error("campaignId and contactIds required");

    const prisma = getPrisma();
    const campaign = await prisma.powerDialerCampaign.findFirst({
      where: { id: campaignId, workspaceId },
      select: { listId: true },
    });
    if (!campaign) throw new Error("Campaign not found");

    const sourceList = await prisma.contactList.findFirst({
      where: { id: sourceListId, workspaceId },
      select: { id: true },
    });
    if (!sourceList) throw new Error("List not found");

    const members = await prisma.contactListMember.findMany({
      where: { listId: sourceListId, contactId: { in: contactIds } },
      select: { contactId: true },
    });
    const ids = members.map((m) => m.contactId);
    if (!ids.length) throw new Error("No contacts from this list in selection");

    const result = await addContactsToList(workspaceId, campaign.listId, ids);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
