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
        status: { in: ["ringing", "initiated", "queued", "in_progress"] },
        OR: [
          { direction: "inbound" },
          {
            direction: "outbound",
            source: "power_dialer",
          },
        ],
      },
      orderBy: { startedAt: "desc" },
      take: 8,
    });

    const call = recent.find((row) => {
      const meta = (row.metadata || {}) as {
        inboundBridge?: string;
        inboundBridgeStatus?: string;
        outboundAgentLeg?: string;
        outboundAgentLegStatus?: string;
      };
      if (meta.inboundBridge === "dial_agent" && meta.inboundBridgeStatus !== "bridged") {
        return true;
      }
      return (
        row.direction === "outbound" &&
        meta.outboundAgentLeg === "dial_agent" &&
        meta.outboundAgentLegStatus !== "bridged"
      );
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

    const displayFrom =
      call.direction === "outbound" && call.to ? call.to : call.from;

    return NextResponse.json({
      data: {
        humanCallId: call.id,
        fromE164: displayFrom,
        callerName:
          call.direction === "outbound"
            ? callerName || "Power dialer"
            : callerName,
        startedAt: call.startedAt.toISOString(),
        outboundPowerDialerAgentLeg: call.direction === "outbound",
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
