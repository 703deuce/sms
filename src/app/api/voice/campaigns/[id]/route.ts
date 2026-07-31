import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  enrollCampaignAudience,
  pauseCampaign,
  startCampaign,
} from "@/lib/voice/campaigns";
import { requireVoicePermission } from "@/lib/voice/permissions";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      action?: string;
      audience?: {
        listId?: string;
        phones?: string[];
        excludeResponders?: boolean;
        requireConsent?: boolean;
      };
      voicemailRules?: Record<string, unknown>;
      callingRules?: Record<string, unknown>;
    };

    if (body.action === "start") {
      await requireVoicePermission(auth.session.userId, auth.workspaceId, "start_campaign");
      const result = await startCampaign(auth.workspaceId, id);
      return NextResponse.json({ data: result });
    }
    if (body.action === "pause") {
      await requireVoicePermission(auth.session.userId, auth.workspaceId, "start_campaign");
      return NextResponse.json({ data: await pauseCampaign(auth.workspaceId, id) });
    }
    if (body.action === "enroll") {
      await requireVoicePermission(auth.session.userId, auth.workspaceId, "start_campaign");
      const result = await enrollCampaignAudience(auth.workspaceId, id, body.audience || {});
      return NextResponse.json({ data: result });
    }

    const row = await getPrisma().voiceCampaign.updateMany({
      where: { id, workspaceId: auth.workspaceId },
      data: {
        voicemailRules: body.voicemailRules as object | undefined,
        callingRules: body.callingRules as object | undefined,
      },
    });
    return NextResponse.json({ data: { updated: row.count } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
