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

    return NextResponse.json({
      data: {
        dispositionSetId: set?.id ?? null,
        dispositionLabels,
        scriptRendered,
        voicemailDropId: vmDrop?.id ?? null,
        voicemailDropName: vmDrop?.name ?? null,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
