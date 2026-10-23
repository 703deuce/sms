import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { parseExtendedConfig } from "@/lib/server/phone/power-dialer/campaign-extended-config";
import { startVoicemailDropPlayback } from "@/lib/server/phone/power-dialer/voicemail-drop-playback";
import { getPowerDialerSettings } from "@/lib/server/phone/power-dialer";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(_request);
  if (denied) return denied;
  try {
    const { id: attemptId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const settings = await getPowerDialerSettings(workspaceId);
    if (!(settings as { prerecordedVmOptIn?: boolean }).prerecordedVmOptIn) {
      return NextResponse.json({ error: "Voicemail drops not enabled" }, { status: 403 });
    }
    const prisma = getPrisma();
    const attempt = await prisma.powerDialerAttempt.findFirst({
      where: { id: attemptId, workspaceId },
      include: {
        humanCall: true,
        session: { include: { campaign: true } },
      },
    });
    if (!attempt?.humanCall?.telnyxCallControlId) {
      throw new Error("No connected call leg for playback");
    }
    if (attempt.status !== "answered") {
      throw new Error("Call must be connected to leave a voicemail drop");
    }
    const ext = parseExtendedConfig(attempt.session.campaign.configJson);
    const dropId = ext.voicemailDropId;
    if (!dropId) throw new Error("Campaign has no voicemail drop configured");
    const drop = await prisma.powerDialerVoicemailDrop.findFirst({
      where: { id: dropId, workspaceId, archivedAt: null },
    });
    if (!drop) throw new Error("Voicemail drop not found");

    await startVoicemailDropPlayback({
      telnyxCallControlId: attempt.humanCall.telnyxCallControlId,
      audioUrl: drop.storageUrl,
    });

    await prisma.powerDialerAttempt.update({
      where: { id: attemptId },
      data: {
        voicemailDropSentAt: new Date(),
        disposition: "Voicemail",
        dispositionEffectsAt: attempt.dispositionEffectsAt || new Date(),
      },
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
