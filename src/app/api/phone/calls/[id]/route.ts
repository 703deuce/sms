import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  sendDtmf,
  updateHumanCall,
} from "@/lib/phone/human-call-service";
import { requireSoftphonePermission } from "@/lib/phone/softphone-permissions";

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

    if (body.dtmf) {
      const call = await sendDtmf(id, auth.workspaceId, body.dtmf);
      return NextResponse.json({ data: call });
    }

    const call = await updateHumanCall(id, auth.workspaceId, {
      hangup: body.hangup,
      answer: body.answer,
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
    });

    return NextResponse.json({ data: call });
  } catch (err) {
    return jsonError(err, 400);
  }
}
