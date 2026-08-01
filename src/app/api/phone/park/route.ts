import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listParkedCalls, parkCall, retrieveParkedCall } from "@/lib/phone/park-service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    return NextResponse.json({ data: await listParkedCalls(auth.workspaceId) });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      action?: string;
      humanCallId?: string;
      slotCode?: string;
      timeoutSeconds?: number;
      fallbackTarget?: string;
    };

    if (body.action === "retrieve") {
      if (!body.slotCode) return NextResponse.json({ error: "slotCode required" }, { status: 400 });
      const slot = await retrieveParkedCall({
        workspaceId: auth.workspaceId,
        slotCode: body.slotCode,
        userId: auth.session.userId,
      });
      return NextResponse.json({ data: slot });
    }

    if (!body.humanCallId) {
      return NextResponse.json({ error: "humanCallId required" }, { status: 400 });
    }
    const slot = await parkCall({
      workspaceId: auth.workspaceId,
      humanCallId: body.humanCallId,
      userId: auth.session.userId,
      timeoutSeconds: body.timeoutSeconds,
      fallbackTarget: body.fallbackTarget,
    });
    return NextResponse.json({ data: slot }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
