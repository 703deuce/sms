import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getLiveTestStatus, startLiveTestSession } from "@/lib/mctb/onboarding/live-test";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const status = await getLiveTestStatus(auth.workspaceId);
    return NextResponse.json({ data: status });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    await startLiveTestSession(auth.workspaceId);
    const status = await getLiveTestStatus(auth.workspaceId);
    return NextResponse.json({ ok: true, data: status });
  } catch (err) {
    return jsonError(err, 500);
  }
}
