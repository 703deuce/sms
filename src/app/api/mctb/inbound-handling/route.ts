import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  INBOUND_HANDLING_MODE_LABELS,
  loadMctbLineInboundConfig,
  resolveInboundHandlingDecision,
  setInboundHandlingMode,
  getVoiceAgentReadiness,
} from "@/lib/mctb/inbound-handling";
import type { InboundHandlingMode } from "@/lib/mctb/inbound-handling/types";

export async function GET(request: Request) {
  try {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const phoneNumberId = url.searchParams.get("phoneNumberId");

  const line = await loadMctbLineInboundConfig({
    workspaceId: auth.workspaceId,
    phoneNumberId,
  });
  const decision = await resolveInboundHandlingDecision({
    workspaceId: auth.workspaceId,
    phoneNumberId: line?.phoneNumberId,
    ingressE164: line?.ingressE164,
  });

  let voiceReadiness = null;
  if (line?.voiceAgentId) {
    voiceReadiness = await getVoiceAgentReadiness({
      workspaceId: auth.workspaceId,
      agentId: line.voiceAgentId,
      phoneNumberId: line.phoneNumberId,
    });
  }

  return NextResponse.json({
    data: {
      line,
      decision,
      modeLabel: line
        ? INBOUND_HANDLING_MODE_LABELS[line.inboundHandlingMode]
        : INBOUND_HANDLING_MODE_LABELS.MCTB_RECOVERY,
      activePrimaryHandler: decision.primaryHandler,
      forwarding: line
        ? {
            status: line.forwardingVerified ? "connected" : "pending",
            businessLineE164: line.businessLineE164,
            ingressE164: line.ingressE164,
          }
        : null,
      voiceReadiness,
      sameNumberReused: true,
    },
  });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = String(body.mode || "").trim() as InboundHandlingMode;
  if (mode !== "MCTB_RECOVERY" && mode !== "VOICE_AGENT") {
    return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  }

  const phoneNumberId =
    typeof body.phoneNumberId === "string" ? body.phoneNumberId : null;
  const voiceAgentId =
    typeof body.voiceAgentId === "string" ? body.voiceAgentId : null;

  const result = await setInboundHandlingMode({
    workspaceId: auth.workspaceId,
    mode,
    phoneNumberId,
    voiceAgentId,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        blockingReasons: result.blockingReasons,
      },
      { status: 422 },
    );
  }

  const decision = await resolveInboundHandlingDecision({
    workspaceId: auth.workspaceId,
    phoneNumberId,
  });

  return NextResponse.json({
    data: {
      mode: result.mode,
      telephonyPath: result.telephonyPath,
      decision,
    },
  });
  } catch (err) {
    return jsonError(err, 500);
  }
}
