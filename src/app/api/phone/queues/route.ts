import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { createCallQueue, listCallQueues } from "@/lib/phone/queue-service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listCallQueues(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const data = await createCallQueue(auth.workspaceId, body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
