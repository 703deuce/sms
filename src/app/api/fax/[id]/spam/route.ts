import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { markTransmissionSpam } from "@/lib/fax/fax-blocked-senders";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const body = await request.json();
    const isSpam = Boolean(body.isSpam);
    const blockSender = Boolean(body.blockSender);

    const data = await markTransmissionSpam({
      workspaceId: auth.workspaceId,
      transmissionId: id,
      isSpam,
      blockSender,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
