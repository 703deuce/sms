import "server-only";

import { getPrisma } from "@/lib/db";
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { setActiveCallHandler } from "@/lib/call-handling/set-active-call-handler";
import {
  loadMctbOnboardingState,
  markStepComplete,
  saveMctbOnboardingState,
} from "@/lib/mctb/onboarding/state";
import type { MctbTrialNumberInfo } from "@/lib/mctb/onboarding/types";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import {
  isPlatformMctbSenderPhoneRecord,
  parseMctbPhoneRole,
} from "@/lib/messaging/compliance/phone-number-class";
import { isNorthAmericaTollFreeE164 } from "@/lib/mctb/provisioning/telnyx-toll-free-ingress-pool";
import { resolveMctbWorkspaceIngressMode } from "@/lib/mctb/provisioning/workspace-ingress-mode";
import {
  isMctbTexmlIngressLocked,
  isPhoneMctbSipIngress,
} from "@/lib/mctb/sip-ingress/sync";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { traceMctbDebug } from "@/lib/mctb/debug";

export type WorkspaceMctbIngressCandidate = {
  id: string;
  e164: string;
  purchasedAt: Date | null;
};

function hasPersistedMctbIngressProvisioning(settingsJson: unknown): boolean {
  if (isMctbTexmlIngressLocked(settingsJson)) return true;
  if (!isPhoneMctbSipIngress(settingsJson)) return false;
  const role = parseMctbPhoneRole(settingsJson);
  return role === "customer_mctb" || role === "customer_production" || role === "customer_voice_only";
}

/** Workspace-owned Telnyx toll-free numbers already wired for MCTB ingress (oldest first). */
export async function listWorkspaceMctbIngressCandidates(
  workspaceId: string,
): Promise<WorkspaceMctbIngressCandidate[]> {
  if (resolveMctbWorkspaceIngressMode() !== "toll_free_texml") {
    return [];
  }

  const prisma = getPrisma();
  const canonical = await resolveCanonicalMctbPlatformSender();
  const phones = await prisma.phoneNumber.findMany({
    where: {
      workspaceId,
      provider: "telnyx",
      status: { notIn: ["released", "Released"] },
    },
    orderBy: { purchasedAt: "asc" },
    select: { id: true, e164: true, settingsJson: true, providerNumberId: true, purchasedAt: true },
  });

  const out: WorkspaceMctbIngressCandidate[] = [];
  for (const phone of phones) {
    if (!phone.e164 || !isNorthAmericaTollFreeE164(phone.e164)) continue;
    if (!phone.providerNumberId) continue;
    if (isPlatformMctbSenderPhoneRecord({ settingsJson: phone.settingsJson })) continue;
    if (parseMctbPhoneRole(phone.settingsJson) === "platform_mctb_sender") continue;
    if (canonical?.phoneNumberId === phone.id) continue;
    if (!hasPersistedMctbIngressProvisioning(phone.settingsJson)) continue;
    out.push({ id: phone.id, e164: phone.e164, purchasedAt: phone.purchasedAt });
  }
  return out;
}

export function pickCanonicalWorkspaceIngressCandidate(
  candidates: WorkspaceMctbIngressCandidate[],
  preferredE164?: string | null,
): WorkspaceMctbIngressCandidate | null {
  if (candidates.length === 0) return null;
  if (candidates.length > 1) {
    // Duplicate ingress TFNs — keep the first provisioned number (resume must not rotate CFNA target).
    return candidates[0];
  }
  const e164 = preferredE164?.trim();
  if (e164) {
    const match = candidates.find((c) => c.e164 === e164);
    if (match) return match;
  }
  return candidates[0] ?? null;
}

async function adoptWorkspaceIngressPhone(
  workspaceId: string,
  phone: WorkspaceMctbIngressCandidate,
): Promise<void> {
  const info: MctbTrialNumberInfo = {
    e164: phone.e164,
    phoneNumberId: phone.id,
    provider: "telnyx",
    numberType: "toll_free",
    voiceStatus: "ready",
    messagingVerificationStatus: "not_started",
    provisionedAt: new Date().toISOString(),
  };

  await updateMissedCallTextConfig({
    workspaceId,
    patch: { phone_number_id: phone.id },
    source: "mctb_ingress_canonical_sync",
  });

  await setActiveCallHandler({
    workspaceId,
    voiceIngressPhoneNumberId: phone.id,
    handler: "mctb",
  }).catch(() => undefined);

  const state = await loadMctbOnboardingState(workspaceId);
  const nextState = markStepComplete(
    {
      ...state,
      workspaceTollFreeNumber: info,
      trialNumber: info,
    },
    "trial_number",
  );
  await saveMctbOnboardingState(workspaceId, nextState);
}

export type SyncCanonicalMctbWorkspaceIngressResult = {
  ok: boolean;
  synced: boolean;
  phoneNumberId?: string;
  e164?: string;
  reason?: "already_aligned" | "no_candidates" | "adopted";
};

/**
 * Align runtime + onboarding state to one workspace-owned ingress TFN.
 * Reuses the oldest valid ingress when duplicates exist — never purchases numbers.
 */
export async function syncCanonicalMctbWorkspaceIngress(
  workspaceId: string,
): Promise<SyncCanonicalMctbWorkspaceIngressResult> {
  const candidates = await listWorkspaceMctbIngressCandidates(workspaceId);
  if (candidates.length === 0) {
    return { ok: true, synced: false, reason: "no_candidates" };
  }

  const state = await loadMctbOnboardingState(workspaceId);
  const workspaceTollFree = getWorkspaceTollFreeNumber(state);
  const runtime = await loadMissedCallTextConfig(workspaceId);

  const canonical = pickCanonicalWorkspaceIngressCandidate(candidates, workspaceTollFree?.e164);
  if (!canonical) {
    return { ok: true, synced: false, reason: "no_candidates" };
  }

  const runtimeId = runtime.phoneNumberId?.trim();
  const stateId = workspaceTollFree?.phoneNumberId?.trim();
  const aligned =
    runtimeId === canonical.id &&
    stateId === canonical.id &&
    workspaceTollFree?.e164 === canonical.e164;

  if (aligned) {
    return {
      ok: true,
      synced: false,
      phoneNumberId: canonical.id,
      e164: canonical.e164,
      reason: "already_aligned",
    };
  }

  await adoptWorkspaceIngressPhone(workspaceId, canonical);
  traceMctbDebug("provision", "ingress_canonical_sync", {
    workspaceId,
    phoneNumberId: canonical.id,
    e164: canonical.e164,
    priorRuntimeId: runtimeId ?? null,
    priorStateId: stateId ?? null,
    candidateCount: candidates.length,
  });

  return {
    ok: true,
    synced: true,
    phoneNumberId: canonical.id,
    e164: canonical.e164,
    reason: "adopted",
  };
}
