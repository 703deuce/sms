import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getLiveTestStatus, startLiveTestSession } from "@/lib/mctb/onboarding/live-test";
import { traceMctbDebug, traceMctbDebugError } from "@/lib/mctb/debug";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    traceMctbDebug("live-test", "get_start", { workspaceId: auth.workspaceId });
    const status = await getLiveTestStatus(auth.workspaceId);
    traceMctbDebug("live-test", "get_complete", {
      workspaceId: auth.workspaceId,
      started: status.started,
      passed: status.passed,
    });
    return NextResponse.json({ data: status });
  } catch (err) {
    traceMctbDebugError("live-test", "get_failed", err);
    return jsonError(err, 500);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await req.json().catch(() => ({}));
    const restart = Boolean(
      (body as { restart?: boolean }).restart ||
        new URL(req.url).searchParams.get("restart") === "1",
    );
    traceMctbDebug("live-test", "post_start", { workspaceId: auth.workspaceId, restart });
    await startLiveTestSession(auth.workspaceId, { restart });
    const status = await getLiveTestStatus(auth.workspaceId);
    traceMctbDebug("live-test", "post_complete", {
      workspaceId: auth.workspaceId,
      started: status.started,
      passed: status.passed,
    });
    return NextResponse.json({ ok: true, data: status });
  } catch (err) {
    traceMctbDebugError("live-test", "post_failed", err);
    return jsonError(err, 500);
  }
}
