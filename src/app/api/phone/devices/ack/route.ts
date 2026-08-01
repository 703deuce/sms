import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { ackSoftphoneIncomingCall } from "@/lib/phone/device-service";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      deviceKey?: string;
      humanCallId?: string;
    };
    if (!body.deviceKey?.trim() || !body.humanCallId?.trim()) {
      return NextResponse.json({ error: "deviceKey and humanCallId required" }, { status: 400 });
    }
    const result = await ackSoftphoneIncomingCall({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      deviceKey: body.deviceKey,
      humanCallId: body.humanCallId,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
