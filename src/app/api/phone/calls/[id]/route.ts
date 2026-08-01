import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  sendDtmf,
  updateHumanCall,
} from "@/lib/phone/human-call-service";
import { requireSoftphonePermission } from "@/lib/phone/softphone-permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const call = await getPrisma().humanCall.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
    return NextResponse.json({ data: call });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = (await request.json()) as {
      hangup?: boolean;
      answer?: boolean;
      muted?: boolean;
      onHold?: boolean;
      transferTo?: string;
      warmTransferTo?: string;
      consult?: boolean;
      completeWarmTransfer?: boolean;
      cancelWarmTransfer?: boolean;
      switchLine?: boolean;
      notes?: string | null;
      disposition?: string | null;
      dtmf?: string;
      record?: boolean;
      flipTo?: string;
      whisper?: string;
      blockCaller?: boolean;
      startTranscription?: boolean;
      generateAiSummary?: boolean;
      telnyxCallControlId?: string;
      webrtcCallId?: string;
    };

    if (body.record) {
      await requireSoftphonePermission(auth.workspaceId, auth.session.userId, "record");
    }
    if (body.transferTo || body.warmTransferTo || body.completeWarmTransfer) {
      await requireSoftphonePermission(auth.workspaceId, auth.session.userId, "transfer");
    }
    if (body.whisper) {
      await requireSoftphonePermission(auth.workspaceId, auth.session.userId, "whisper");
    }
    if (body.blockCaller) {
      await requireSoftphonePermission(auth.workspaceId, auth.session.userId, "block_caller");
    }
    if (body.flipTo) {
      await requireSoftphonePermission(auth.workspaceId, auth.session.userId, "flip");
    }

    if (body.dtmf) {
      const call = await sendDtmf(id, auth.workspaceId, body.dtmf);
      return NextResponse.json({ data: call });
    }

    const call = await updateHumanCall(id, auth.workspaceId, {
      hangup: body.hangup,
      answer: body.answer,
      agentUserId: body.answer ? auth.session.userId : undefined,
      muted: body.muted,
      onHold: body.onHold,
      transferTo: body.transferTo,
      warmTransferTo: body.warmTransferTo,
      consult: body.consult,
      completeWarmTransfer: body.completeWarmTransfer,
      cancelWarmTransfer: body.cancelWarmTransfer,
      switchLine: body.switchLine,
      notes: body.notes,
      disposition: body.disposition,
      record: body.record,
      flipTo: body.flipTo,
      whisper: body.whisper,
      blockCaller: body.blockCaller,
      startTranscription: body.startTranscription,
      generateAiSummary: body.generateAiSummary,
      telnyxCallControlId: body.telnyxCallControlId,
      webrtcCallId: body.webrtcCallId,
    });

    return NextResponse.json({ data: call });
  } catch (err) {
    return jsonError(err, 400);
  }
}
