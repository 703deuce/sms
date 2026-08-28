import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { requireMassTextingWorkspace } from "@/lib/mass-texting/access";
import { previewBroadcastAudience } from "@/lib/mass-texting/broadcast/audience";
import type { BroadcastAudienceDefinition } from "@/lib/mass-texting/broadcast/types";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireMassTextingWorkspace(auth.workspaceId);

    const body = (await request.json()) as {
      audience: BroadcastAudienceDefinition;
      campaignId?: string;
    };
    if (!body.audience?.include?.length) {
      return NextResponse.json({ error: "audience.include is required" }, { status: 400 });
    }

    const preview = await previewBroadcastAudience(
      auth.workspaceId,
      body.audience,
      body.campaignId ?? null,
    );
    return NextResponse.json({ data: preview });
  } catch (err) {
    return jsonError(err, 400);
  }
}
