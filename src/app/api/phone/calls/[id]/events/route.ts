import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { listHumanCallEvents } from "@/lib/phone/call-events";

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
    if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const events = await listHumanCallEvents(auth.workspaceId, id);
    return NextResponse.json({ data: { call, events } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
