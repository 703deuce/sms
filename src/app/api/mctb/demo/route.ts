import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import { getDemoStatus, startDemoSession } from "@/lib/mctb/onboarding/demo";
import type { MctbConsentMode } from "@/lib/mctb/onboarding/types";

async function applyDemoConsentMode(
  workspaceId: string,
  userId: string,
  consentMode: MctbConsentMode,
  existingConsentAttested?: boolean,
) {
  if (consentMode === "existing_consent" && existingConsentAttested !== true) {
    throw new Error("Existing consent attestation is required");
  }
  const prisma = getPrisma();
  await saveMissedCallTextBack(workspaceId, { activate: false });
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
  const { syncMctbConsentRouting } = await import("@/lib/mctb/consent-prompt/service");
  await syncMctbConsentRouting(workspaceId, userId).catch(() => undefined);
  const { syncPlatformDemoConsentRuntime } = await import("@/lib/mctb/onboarding/platform-demo");
  await syncPlatformDemoConsentRuntime(consentMode).catch(() => undefined);
  if (consentMode === "existing_consent") {
    const { recordWorkspaceExistingConsentAttestation } = await import(
      "@/lib/mctb/event-only/attestation"
    );
    await recordWorkspaceExistingConsentAttestation({
      workspaceId,
      attestedByUserId: userId,
    }).catch(() => undefined);
  }
}

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const status = await getDemoStatus(auth.workspaceId);
    return NextResponse.json({ data: status });
  } catch (err) {
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
    };

    if (body.consentMode) {
      await applyDemoConsentMode(
        auth.workspaceId,
        auth.session.userId,
        body.consentMode,
        body.existingConsentAttested,
      );
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: auth.session.userId },
      select: { phone: true },
    });
    if (!user?.phone) {
      return NextResponse.json(
        { error: "Verify your mobile number before starting the demo." },
        { status: 400 },
      );
    }

    const result = await startDemoSession({
      workspaceId: auth.workspaceId,
      callerE164: user.phone,
    });

    return NextResponse.json({
      ok: true,
      data: {
        demoNumberE164: result.demoNumberE164,
        session: result.session,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
