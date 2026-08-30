import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import { getDemoStatus, startDemoSession } from "@/lib/mctb/onboarding/demo";
import type { MctbConsentMode } from "@/lib/mctb/onboarding/types";
import { traceMctbDebug, traceMctbDebugError } from "@/lib/mctb/debug";

async function applyDemoConsentMode(
  workspaceId: string,
  userId: string,
  consentMode: MctbConsentMode,
  existingConsentAttested?: boolean,
  context?: "try_it" | "onboarding",
) {
  if (consentMode === "existing_consent" && existingConsentAttested !== true) {
    throw new Error("Existing consent attestation is required");
  }
  const prisma = getPrisma();
  // Try It uses ensureTryItMctbRuntimeReady — do not deactivate production MCTB here.
  if (context !== "try_it") {
    await saveMissedCallTextBack(workspaceId, { activate: false });
  }
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const cfg =
    ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      customFieldsConfig: {
        ...cfg,
        mctb: { ...mctb, consentMode },
        mctbOnboarding: {
          ...(cfg.mctbOnboarding && typeof cfg.mctbOnboarding === "object"
            ? (cfg.mctbOnboarding as object)
            : {}),
          consentMode,
        },
      },
    },
  });
  // Smart Routing consent flows are for customer DIDs — not the shared Try It line.
  if (context !== "try_it") {
    const { syncMctbConsentRouting } = await import("@/lib/mctb/consent-prompt/service");
    await syncMctbConsentRouting(workspaceId, userId).catch(() => undefined);
  }
  const { syncPlatformDemoConsentRuntime } = await import("@/lib/mctb/onboarding/platform-demo");
  const platformRuntime = await syncPlatformDemoConsentRuntime(consentMode).catch((err) => {
    console.error("[demo] syncPlatformDemoConsentRuntime", err);
    return { mode: consentMode, action: "sip_ingress_failed" as const };
  });
  if (consentMode === "existing_consent") {
    const { recordWorkspaceExistingConsentAttestation } = await import(
      "@/lib/mctb/capture/attestation"
    );
    await recordWorkspaceExistingConsentAttestation({
      workspaceId,
      attestedByUserId: userId,
    }).catch(() => undefined);
  }

  return platformRuntime;
}

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    traceMctbDebug("demo", "get_start", { workspaceId: auth.workspaceId });
    const status = await getDemoStatus(auth.workspaceId);
    traceMctbDebug("demo", "get_complete", {
      workspaceId: auth.workspaceId,
      sessionActive: Boolean(status.session),
      completed: status.completed,
    });
    return NextResponse.json({ data: status });
  } catch (err) {
    traceMctbDebugError("demo", "get_failed", err);
    return jsonError(err, 500);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as {
      consentMode?: MctbConsentMode;
      existingConsentAttested?: boolean;
      context?: "try_it" | "onboarding";
    };

    const context = body.context === "onboarding" ? "onboarding" : "try_it";
    traceMctbDebug("demo", "post_start", {
      workspaceId: auth.workspaceId,
      consentMode: body.consentMode ?? null,
      context,
    });

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: auth.session.userId },
      select: { phone: true, email: true },
    });

    let platformRuntime: Awaited<ReturnType<typeof applyDemoConsentMode>> | null = null;
    if (body.consentMode) {
      platformRuntime = await applyDemoConsentMode(
        auth.workspaceId,
        auth.session.userId,
        body.consentMode,
        body.existingConsentAttested,
        context,
      );
    }
    if (!user?.phone) {
      return NextResponse.json(
        { error: "Verify your mobile number before starting the demo." },
        { status: 400 },
      );
    }

    const result = await startDemoSession({
      workspaceId: auth.workspaceId,
      callerE164: user.phone,
      context,
      userEmail: user.email,
    });

    if (platformRuntime?.action === "sip_ingress_failed") {
      return NextResponse.json(
        {
          error:
            "Demo line voice routing could not be verified. Try again in a moment or contact support.",
          voiceRoute: platformRuntime,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        demoNumberE164: result.demoNumberE164,
        session: result.session,
        voiceRoute: platformRuntime,
      },
    });
  } catch (err) {
    traceMctbDebugError("demo", "post_failed", err);
    return jsonError(err, 500);
  }
}
