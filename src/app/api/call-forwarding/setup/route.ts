import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadCallForwardingSetup, saveCallForwardingSetup } from "@/lib/call-forwarding/setup-service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadCallForwardingSetup(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await req.json();
    const data = await saveCallForwardingSetup(auth.workspaceId, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
