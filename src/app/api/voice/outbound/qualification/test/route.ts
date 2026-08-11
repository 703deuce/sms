import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { triggerOutboundQualificationCall } from "@/lib/voice/outbound/trigger-qualification-call";

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token === secret;
}

/**
 * Start a LiveKit outbound lead qualification test call.
 *
 * Auth:
 * - Signed-in workspace session (Voice testing lab / integrations)
 * - Authorization: Bearer $CRON_SECRET (for Coolify cron / external trigger)
 *
 * Body: { destinationPhone, agentId?, leadName?, contactId?, workspaceId?, realtimeVoice? }
 * workspaceId is required for CRON_SECRET calls.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      destinationPhone?: string;
      agentId?: string;
      leadName?: string;
      contactId?: string;
      workspaceId?: string;
      realtimeVoice?: string;
    };

    const destinationPhone = (body.destinationPhone || process.env.OUTBOUND_TEST_PHONE || "").trim();
    if (!destinationPhone) {
      return NextResponse.json(
        { error: "destinationPhone is required (or set OUTBOUND_TEST_PHONE in env)" },
        { status: 400 },
      );
    }

    let workspaceId: string;
    let triggerSource: string;

    if (cronAuthorized(request)) {
      workspaceId = (body.workspaceId || process.env.WORKSPACE_ID || "").trim();
      if (!workspaceId) {
        return NextResponse.json(
          { error: "workspaceId is required for cron-triggered outbound tests" },
          { status: 400 },
        );
      }
      triggerSource = "cron_api";
    } else {
      const auth = await requireSession();
      if ("error" in auth) return auth.error;
      workspaceId = auth.workspaceId;
      triggerSource = "voice_api";
    }

    const result = await triggerOutboundQualificationCall({
      workspaceId,
      agentId: body.agentId,
      destinationPhone,
      leadName: body.leadName,
      contactId: body.contactId,
      triggerSource,
      requireTestModeEnv: false,
      realtimeVoice: body.realtimeVoice,
    });

    if (result.status === "failed") {
      return NextResponse.json(
        { error: result.error || "Outbound call failed to start", data: result },
        { status: 502 },
      );
    }

    return NextResponse.json({
      data: {
        ...result,
        mode: "livekit_outbound_qualification",
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
