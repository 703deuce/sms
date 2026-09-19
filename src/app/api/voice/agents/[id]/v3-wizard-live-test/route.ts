import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createWizardV3BrowserLiveTest,
  endWizardV3BrowserLiveTest,
} from "@/lib/voice-v3-basic/wizard-browser-live-test";

/**
 * POST — establish OpenAI Live WebRTC for wizard Step 7 (draft Voice V3 config).
 * DELETE — hang up browser test session.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: agentId } = await params;
    const body = (await request.json()) as { sdp?: string; offerSdp?: string };
    const offerSdp = body.offerSdp || body.sdp || "";

    const result = await createWizardV3BrowserLiveTest({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      agentId,
      offerSdp,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: agentId } = await params;
    const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
    if (!body.sessionId?.trim()) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    await endWizardV3BrowserLiveTest({
      workspaceId: auth.workspaceId,
      agentId,
      sessionId: body.sessionId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 500);
  }
}
