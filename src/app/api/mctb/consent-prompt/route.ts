import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import {
  generateMctbConsentAudio,
  getMctbConsentPromptStatus,
  publishMctbConsentPrompt,
  syncMctbConsentRouting,
} from "@/lib/mctb/consent-prompt/service";
import { saveMctbConsentPrompt } from "@/lib/mctb/consent-prompt/store";
import { traceMctbDebug, traceMctbDebugError } from "@/lib/mctb/debug";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  traceMctbDebug("consent-prompt", "get_start", { workspaceId });
  const status = await getMctbConsentPromptStatus(workspaceId);
  traceMctbDebug("consent-prompt", "get_complete", {
    workspaceId,
    published: status.isPublished,
    hasAudio: Boolean(status.playbackUrl),
  });
  return NextResponse.json({ data: status });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    scriptText?: string;
    voiceId?: string;
    speed?: number;
    phoneNumberId?: string | null;
  };

  traceMctbDebug("consent-prompt", "post_start", {
    workspaceId,
    action: body.action || "save",
    phoneNumberId: body.phoneNumberId ?? null,
  });

  try {
    if (body.action === "generate") {
      const config = await generateMctbConsentAudio(workspaceId, {
        scriptText: body.scriptText,
        voiceId: body.voiceId,
        speed: body.speed,
      });
      return NextResponse.json({ ok: true, data: config });
    }

    if (body.action === "publish") {
      const config = await publishMctbConsentPrompt(workspaceId, session.userId, {
        assignedPhoneNumberId: body.phoneNumberId || undefined,
      });
      await syncMctbConsentRouting(workspaceId, session.userId, {
        assignedPhoneNumberId: body.phoneNumberId || undefined,
      });
      const status = await getMctbConsentPromptStatus(workspaceId);
      return NextResponse.json({ ok: true, data: status });
    }

    if (body.action === "sync") {
      const result = await syncMctbConsentRouting(workspaceId, session.userId);
      const status = await getMctbConsentPromptStatus(workspaceId);
      return NextResponse.json({ ok: true, result, data: status });
    }

    const { resolveCanonicalMctbConsentScript } = await import(
      "@/lib/mctb/consent-prompt/script-policy"
    );
    const { getPrisma } = await import("@/lib/db");
    const ws = await getPrisma().workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, displayName: true },
    });
    const businessName = ws?.displayName?.trim() || ws?.name?.trim() || "our business";
    const canonicalScript = resolveCanonicalMctbConsentScript(businessName);
    const config = await saveMctbConsentPrompt(workspaceId, {
      scriptText: canonicalScript,
      ...(body.voiceId !== undefined ? { voiceId: body.voiceId } : {}),
      ...(body.speed !== undefined ? { speed: body.speed } : {}),
    });
    return NextResponse.json({ ok: true, data: config });
  } catch (err) {
    traceMctbDebugError("consent-prompt", "post_failed", err, {
      workspaceId,
      action: body.action || "save",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Consent prompt action failed" },
      { status: 400 },
    );
  }
}
