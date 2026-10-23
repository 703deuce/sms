import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import {
  createCallbackFromAiReceptionist,
  enrollAiLeadInCampaign,
  type AiCallbackSource,
} from "@/lib/server/phone/power-dialer/ai-callback-bridge";

/** M74 — AI receptionist → power dialer callback or campaign enrollment. */
export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      action?: string;
      campaignId?: string;
      contactId?: string;
      scheduledAt?: string;
      timezone?: string;
      notes?: string;
      source?: AiCallbackSource;
      assignedUserId?: string;
    };
    const campaignId = String(body.campaignId || "");
    const contactId = String(body.contactId || "");
    if (!campaignId || !contactId) {
      return NextResponse.json({ error: "campaignId and contactId required" }, { status: 400 });
    }
    const source = body.source || "ai_receptionist_missed";
    if (body.action === "enroll_campaign") {
      const data = await enrollAiLeadInCampaign({ workspaceId, campaignId, contactId, source });
      return NextResponse.json({ data });
    }
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();
    const row = await createCallbackFromAiReceptionist({
      workspaceId,
      campaignId,
      contactId,
      scheduledAt,
      timezone: body.timezone,
      notes: body.notes,
      source,
      assignedUserId: body.assignedUserId,
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
