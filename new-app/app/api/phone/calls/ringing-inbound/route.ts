import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";

/** Active inbound call ringing the browser (for WebRTC UI when Telnyx omits caller ID). */
export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const recent = await prisma.humanCall.findMany({
      where: {
        workspaceId,
        direction: "inbound",
        status: { in: ["ringing", "initiated", "queued"] },
      },
      orderBy: { startedAt: "desc" },
      take: 5,
    });

    const call = recent.find((row) => {
      const meta = (row.metadata || {}) as { inboundBridge?: string; inboundBridgeStatus?: string };
      return meta.inboundBridge === "dial_agent" && meta.inboundBridgeStatus !== "bridged";
    });

    if (!call) {
      return NextResponse.json({ data: null });
    }

    const contact = call.contactId
      ? await prisma.contact.findFirst({
          where: { id: call.contactId, workspaceId },
        })
      : null;
    const callerName = contact
      ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company
      : null;

    return NextResponse.json({
      data: {
        humanCallId: call.id,
        fromE164: call.from,
        callerName,
        startedAt: call.startedAt.toISOString(),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
