import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import { resolveWorkspaceId } from "@/lib/server/workspace";

/** Correlate browser Telnyx SDK events with server HumanCall / agent leg webhooks. */
export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const event = String(body.event || "unknown").slice(0, 120);
    phoneServerLog("webrtc-trace", event, {
      workspaceId,
      humanCallId: typeof body.humanCallId === "string" ? body.humanCallId : null,
      webrtcCallId: typeof body.webrtcCallId === "string" ? body.webrtcCallId : null,
      callState: typeof body.callState === "string" ? body.callState : null,
      detail: body.detail ?? null,
      clientAt: typeof body.clientAt === "number" ? body.clientAt : null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 500);
  }
}
