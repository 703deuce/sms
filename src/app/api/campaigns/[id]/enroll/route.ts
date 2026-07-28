import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { enrollContactInCampaign } from "@/lib/campaigns/enroll-campaign";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const { id: campaignId } = await ctx.params;
    const body = (await request.json()) as {
      workspaceId?: string;
      phone?: string;
      email?: string;
      displayName?: string;
      contactId?: string;
      sendDelayMinutes?: number;
      recipients?: Array<{
        phone?: string;
        email?: string;
        displayName?: string;
        contactId?: string;
      }>;
    };

    const workspaceId = await resolveWorkspaceId(auth.session, body.workspaceId);
    const list = body.recipients?.length
      ? body.recipients
      : [{ phone: body.phone, email: body.email, displayName: body.displayName, contactId: body.contactId }];

    const enrolled = [];
    for (const r of list) {
      if (!r.phone && !r.email) continue;
      enrolled.push(
        await enrollContactInCampaign({
          workspaceId,
          campaignId,
          phone: r.phone,
          email: r.email,
          displayName: r.displayName,
          contactId: r.contactId,
          sendDelayMinutes: body.sendDelayMinutes,
        }),
      );
    }

    return NextResponse.json({ data: { enrolledCount: enrolled.length, recipients: enrolled } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
