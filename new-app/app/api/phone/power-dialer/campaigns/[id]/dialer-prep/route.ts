import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { parseExtendedConfig } from "@/lib/server/phone/power-dialer/campaign-extended-config";
import { listDispositionSets } from "@/lib/server/phone/power-dialer/dispositions";
import { renderMergeTemplate } from "@/lib/server/phone/power-dialer/merge-fields";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    const url = new URL(request.url);
    const contactId = url.searchParams.get("contactId")?.trim();

    const prisma = getPrisma();
    const campaign = await prisma.powerDialerCampaign.findFirst({
      where: { id: campaignId, workspaceId },
    });
    if (!campaign) throw new Error("Campaign not found");

    const ext = parseExtendedConfig(campaign.configJson);
    const sets = await listDispositionSets(workspaceId);
    const set =
      sets.find((s) => s.id === ext.dispositionSetId) || sets.find((s) => s.isDefault) || sets[0];
    const dispositionLabels = set?.dispositions.map((d) => d.label) ?? [];

    let scriptRendered: string | null = null;
    if (ext.scriptId && contactId) {
      const script = await prisma.powerDialerScript.findFirst({
        where: { id: ext.scriptId, workspaceId, archivedAt: null },
      });
      const contact = await prisma.contact.findFirst({ where: { id: contactId, workspaceId } });
      const rep = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      if (script && contact) {
        scriptRendered = renderMergeTemplate(script.body, {
          firstName: contact.firstName,
          lastName: contact.lastName,
          company: contact.company,
          phone: contact.phone,
          repName: rep?.name,
          customFields: (contact.customFields as Record<string, unknown>) || null,
        });
      } else if (script) {
        scriptRendered = script.body;
      }
    }

    const vmDropId = ext.voicemailDropId;
    const vmDrop = vmDropId
      ? await prisma.powerDialerVoicemailDrop.findFirst({
          where: { id: vmDropId, workspaceId, archivedAt: null },
        })
      : null;

    let contactCard: Record<string, unknown> | null = null;
    if (contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, workspaceId },
        include: {
          phones: { orderBy: { priority: "asc" } },
          customFieldValues: { include: { field: true } },
          deals: { take: 1, include: { stage: true } },
        },
      });
      if (contact) {
        contactCard = {
          id: contact.id,
          href: `/app/contacts/${contact.id}`,
          email: contact.email,
          title: contact.title,
          timezone: contact.timezone,
          timezoneInferred: contact.timezoneInferred,
          localTimeNote: contact.timezone ? `Local time uses ${contact.timezone}` : null,
          company: contact.company,
          customFields: contact.customFieldValues.map((v) => ({
            key: v.field.key,
            label: v.field.label,
            value: v.valueText ?? v.valueNumber,
          })),
          deal: contact.deals[0]
            ? { id: contact.deals[0].id, title: contact.deals[0].title, stage: contact.deals[0].stage.name }
            : null,
          phones: contact.phones,
        };
      }
    }

    return NextResponse.json({
      data: {
        dispositionSetId: set?.id ?? null,
        dispositionLabels,
        scriptRendered,
        voicemailDropId: vmDrop?.id ?? null,
        voicemailDropName: vmDrop?.name ?? null,
        contactCard,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
