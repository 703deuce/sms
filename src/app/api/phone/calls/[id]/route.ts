import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  sendDtmf,
  updateHumanCall,
} from "@/lib/phone/human-call-service";

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
      notes?: string | null;
      disposition?: string | null;
      dtmf?: string;
      record?: boolean;
    };

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
      notes: body.notes,
      disposition: body.disposition,
      record: body.record,
    });

    return NextResponse.json({ data: call });
  } catch (err) {
    return jsonError(err, 400);
  }
}
