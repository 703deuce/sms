import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { sendSessionEmail } from "@/lib/server/phone/power-dialer/disposition-messaging";

/** M75 — one-touch email from active dialer session. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id: sessionId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      contactId?: string;
      subject?: string;
      body?: string;
      templateId?: string;
    };
    const contactId = String(body.contactId || "");
    if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });
    const { getPowerDialerSettings } = await import("@/lib/server/phone/power-dialer");
    const settings = await getPowerDialerSettings(workspaceId);
    if (!settings.sessionEmailDeliveryEnabled) {
      return NextResponse.json(
        { error: "Session email delivery is disabled in Power Dialer settings" },
        { status: 403 },
      );
    }
    const result = await sendSessionEmail({
      workspaceId,
      sessionId,
      contactId,
      subject: body.subject || "Follow up",
      body: body.body || "",
      templateId: body.templateId,
    });
    return NextResponse.json({ data: result }, { status: result.ok ? 200 : 422 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
