import "server-only";

import { getPrisma } from "@/lib/db";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import { startDemoSession } from "@/lib/mctb/onboarding/demo";
import type { MctbConsentMode } from "@/lib/mctb/onboarding/types";
import { resolveWorkspaceTryItPhone } from "@/lib/mctb/try-it/workspace-phone";
import { ensureTryItDemoVoiceReady, ensureTryItMctbRuntimeReady } from "@/lib/mctb/try-it/demo-voice";

async function applyTryItConsentMode(
  workspaceId: string,
  userId: string,
  consentMode: MctbConsentMode,
  existingConsentAttested: boolean | undefined,
  context: "try_it" | "onboarding",
) {
  if (consentMode === "existing_consent" && existingConsentAttested !== true) {
    throw new Error("Existing consent attestation is required");
  }

  if (context !== "try_it") {
    await saveMissedCallTextBack(workspaceId, { activate: false });
  }

  const prisma = getPrisma();
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

  if (context !== "try_it") {
    const { syncMctbConsentRouting } = await import("@/lib/mctb/consent-prompt/service");
    await syncMctbConsentRouting(workspaceId, userId).catch(() => undefined);
  }

  if (consentMode === "existing_consent") {
    const { recordWorkspaceExistingConsentAttestation } = await import(
      "@/lib/mctb/capture/attestation"
    );
    await recordWorkspaceExistingConsentAttestation({
      workspaceId,
      attestedByUserId: userId,
    }).catch(() => undefined);
  }
}

export async function startMctbTryItSession(input: {
  workspaceId: string;
  userId: string;
  callerE164: string;
  userEmail?: string | null;
  consentMode?: MctbConsentMode;
  existingConsentAttested?: boolean;
  context?: "try_it" | "onboarding";
}) {
  const context = input.context === "onboarding" ? "onboarding" : "try_it";
  const phone = await resolveWorkspaceTryItPhone(input.workspaceId);
  if (!phone) {
    throw new Error(
      "No workspace MCTB number is configured. Assign your number in Setup before starting Try It.",
    );
  }

  if (input.consentMode) {
    await applyTryItConsentMode(
      input.workspaceId,
      input.userId,
      input.consentMode,
      input.existingConsentAttested,
      context,
    );
  }

  await ensureTryItMctbRuntimeReady({
    workspaceId: input.workspaceId,
    phoneNumberId: phone.phoneNumberId,
    userEmail: input.userEmail,
  });
  await ensureTryItDemoVoiceReady(input.workspaceId).catch((err) => {
    console.error("[try-it] ensureTryItDemoVoiceReady", err);
  });

  const result = await startDemoSession({
    workspaceId: input.workspaceId,
    callerE164: input.callerE164,
    context,
    userEmail: input.userEmail,
    demoNumberE164: phone.e164,
    phoneNumberId: phone.phoneNumberId,
  });

  return { ...result, phoneNumberId: phone.phoneNumberId };
}
