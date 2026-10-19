import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { createReceptionistBrowserLiveKitTest } from "@/lib/server/voice-v3/livekit/browser-test";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { version?: "draft" | "live" };
    const version = body.version === "live" ? "live" : "draft";
    const userId = "browser-user";
    const result = await createReceptionistBrowserLiveKitTest({
      workspaceId,
      userId,
      version,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 500);
  }
}
