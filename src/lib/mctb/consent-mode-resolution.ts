import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import {
  resolveMctbConsentModeFromCustomFields,
  type MctbConsentModeSource,
} from "@/lib/mctb/consent-mode-resolution-core";

export type { MctbConsentModeSource };
export { resolveMctbConsentModeFromCustomFields };

export async function resolveMctbConsentModeForWorkspace(
  workspaceId: string,
): Promise<{ mode: MctbConsentMode; source: MctbConsentModeSource }> {
  const prisma = getPrisma();
  const [ws, solution] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { customFieldsConfig: true },
    }),
    loadMissedCallTextBack(workspaceId).catch(() => null),
  ]);

  const solutionConsentMode =
    solution?.config && typeof solution.config === "object"
      ? (solution.config as Record<string, unknown>).consentMode
      : undefined;

  return resolveMctbConsentModeFromCustomFields({
    customFieldsConfig: ws?.customFieldsConfig,
    solutionConsentMode,
  });
}

/**
 * Copy resolved mode into customFieldsConfig.mctb.consentMode when it was inferred
 * from solution, onboarding, or attestation — prevents bootstrap/seed from reverting to Press 1.
 */
export async function persistCanonicalMctbConsentModeIfNeeded(
  workspaceId: string,
  resolved: { mode: MctbConsentMode; source: MctbConsentModeSource },
): Promise<void> {
  if (resolved.source === "canonical_mctb" || resolved.source === "default") {
    return;
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
  if (typeof mctb.consentMode === "string" && mctb.consentMode.length > 0) {
    return;
  }

  const onboardingRaw =
    cfg.mctbOnboarding && typeof cfg.mctbOnboarding === "object"
      ? (cfg.mctbOnboarding as Record<string, unknown>)
      : {};
  const onboardingNext =
    onboardingRaw.version != null
      ? { ...onboardingRaw, consentMode: resolved.mode }
      : onboardingRaw;

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      customFieldsConfig: {
        ...cfg,
        ...(onboardingRaw.version != null ? { mctbOnboarding: onboardingNext } : {}),
        mctb: {
          ...mctb,
          consentMode: resolved.mode,
        },
      },
    },
  });

  const { warmMctbTexmlIngressCacheForWorkspace } = await import(
    "@/lib/mctb/texml-ingress/config-cache"
  );
  void warmMctbTexmlIngressCacheForWorkspace(workspaceId).catch(() => undefined);
}
