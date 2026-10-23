import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import {
  createWebRtcOutboundCall,
  finalizeWebRtcClientHangup,
  handleInboundCall,
  linkHumanCallControlId,
  listCalls,
  registerInboundAnswer,
} from "@/lib/server/phone/calls-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const { data, total } = await listCalls(workspaceId, {
      limit: Number(url.searchParams.get("limit") || 12),
      page: Number(url.searchParams.get("page") || 0),
      direction: url.searchParams.get("direction") || undefined,
      q: url.searchParams.get("q") || undefined,
      numberId: url.searchParams.get("numberId") || undefined,
      filter: url.searchParams.get("filter") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      source: url.searchParams.get("source") || undefined,
    });
    return NextResponse.json({ data, meta: { total } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "outbound_register");

    if (action === "outbound_register") {
      const result = await createWebRtcOutboundCall({
        workspaceId,
        to: String(body.to || ""),
        from: typeof body.from === "string" ? body.from : null,
        source:
          body.source === "power_dialer" ||
          body.source === "callback" ||
          body.source === "inbound" ||
          body.source === "dialer"
            ? body.source
            : "dialer",
        webrtcCallId: typeof body.webrtcCallId === "string" ? body.webrtcCallId : null,
        powerDialerAttemptId:
          typeof body.powerDialerAttemptId === "string" ? body.powerDialerAttemptId : null,
        idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
      });
      return NextResponse.json({ data: result });
    }

    if (action === "link_control") {
      const updated = await linkHumanCallControlId(
        workspaceId,
        String(body.humanCallId || ""),
        String(body.telnyxCallControlId || ""),
        typeof body.webrtcCallId === "string" ? body.webrtcCallId : null,
      );
      return NextResponse.json({ data: updated });
    }

    if (action === "webrtc_finalize") {
      const result = await finalizeWebRtcClientHangup({
        workspaceId,
        humanCallId: String(body.humanCallId || ""),
        wasAnswered: body.wasAnswered === true,
        failed: body.failed === true,
      });
      return NextResponse.json({ data: result });
    }

    if (action === "inbound_answer") {
      const updated = await registerInboundAnswer({
        workspaceId,
        humanCallId: String(body.humanCallId || ""),
        webrtcCallId: typeof body.webrtcCallId === "string" ? body.webrtcCallId : null,
      });
      return NextResponse.json({ data: updated });
    }

    if (action === "inbound_reject") {
      const { rejectInboundCall } = await import("@/lib/server/phone/inbound-runtime");
      const updated = await rejectInboundCall({
        workspaceId,
        humanCallId: String(body.humanCallId || ""),
      });
      return NextResponse.json({ data: updated });
    }

    if (action === "simulate_inbound") {
      if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PHONE_TEST_INBOUND) {
        return NextResponse.json({ error: "Not available" }, { status: 403 });
      }
      const call = await handleInboundCall({
        workspaceId,
        fromE164: String(body.from || ""),
        toE164: String(body.to || ""),
        telnyxCallControlId: typeof body.telnyxCallControlId === "string" ? body.telnyxCallControlId : undefined,
      });
      return NextResponse.json({ data: call });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
