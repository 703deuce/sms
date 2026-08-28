import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { isPhoneMctbSipIngress } from "@/lib/mctb/sip-ingress/sync";
import { generatePromptAudio } from "@/lib/smart-routing/media-service";
import { pauseFlow } from "@/lib/smart-routing/flow-service";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { resolvePlatformDemoOwnerWorkspaceId } from "@/lib/mctb/onboarding/platform-demo";
import {
  canPublishConsentPrompt,
  computeConsentScriptHash,
  isConsentPromptPublished,
  loadMctbConsentPrompt,
  saveMctbConsentPrompt,
} from "./store";
import { MCTB_CONSENT_FLOW_NAME } from "./types";

import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { normalizeMctbConsentMode } from "@/lib/mctb/consent-mode";

export type { MctbConsentMode };

export async function loadMctbConsentMode(workspaceId: string): Promise<MctbConsentMode> {
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
  const mode = normalizeMctbConsentMode(mctb.consentMode);
  return mode;
}

async function resolveWorkspaceTfnPhoneNumberId(workspaceId: string): Promise<string | null> {
  const state = await loadMctbOnboardingState(workspaceId);
  const fromState = getWorkspaceTollFreeNumber(state)?.phoneNumberId;
  if (fromState) return fromState;

  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: {
      workspaceId,
      type: { in: ["TollFree", "Toll-free"] },
      status: { not: "Released" },
    },
    orderBy: { purchasedAt: "desc" },
    select: { id: true },
  });
  return pn?.id || null;
}

/** MCTB number selected in Setup — local 10DLC, toll-free, or admin-linked production DID. */
async function resolveMctbAssignedPhoneNumberId(
  workspaceId: string,
  overridePhoneNumberId?: string | null,
): Promise<string | null> {
  const { resolveMctbPhoneNumberIdForWorkspace } = await import(
    "@/lib/mctb/platform-production-routing"
  );

  if (overridePhoneNumberId) {
    const resolved = await resolveMctbPhoneNumberIdForWorkspace({
      workspaceId,
      phoneNumberId: overridePhoneNumberId,
    });
    if (resolved) return resolved;
  }

  const runtime = await loadMissedCallTextConfig(workspaceId);
  if (runtime.phoneNumberId) {
    const resolved = await resolveMctbPhoneNumberIdForWorkspace({
      workspaceId,
      phoneNumberId: runtime.phoneNumberId,
    });
    if (resolved) return resolved;
  }
  return resolveWorkspaceTfnPhoneNumberId(workspaceId);
}

async function findMctbConsentFlow(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.smartRoutingFlow.findFirst({
    where: {
      workspaceId,
      type: "missed_call_recovery",
      name: MCTB_CONSENT_FLOW_NAME,
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** Legacy Smart Routing consent flows must stay paused — MCTB voice is Call Control only. */
async function pauseLegacyMctbConsentFlows(
  workspaceId: string,
  phoneNumberId?: string | null,
): Promise<void> {
  const prisma = getPrisma();
  const flows = await prisma.smartRoutingFlow.findMany({
    where: {
      workspaceId,
      status: "active",
      OR: [
        { name: MCTB_CONSENT_FLOW_NAME, type: "missed_call_recovery" },
        ...(phoneNumberId ? [{ assignedPhoneNumberId: phoneNumberId }] : []),
      ],
    },
    select: { id: true },
  });
  for (const flow of flows) {
    await pauseFlow(workspaceId, flow.id).catch(() => undefined);
  }
}

async function resolveMctbProvisionRole(
  phoneNumberId: string,
): Promise<"platform_demo" | "customer_mctb"> {
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId },
    select: { e164: true },
  });
  return pn?.e164 === MCTB_PLATFORM_DEMO_E164 ? "platform_demo" : "customer_mctb";
}

/** Wire Telnyx DID to shared mctb-event-only Call Control app (never Transovo Voice / SR flows). */
async function provisionMctbCallControlVoiceForNumber(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<{ ok: boolean; actions?: string[]; error?: string }> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId },
    select: { id: true, provider: true },
  });
  if (!phone?.id || String(phone.provider || "").toLowerCase() !== "telnyx") {
    return { ok: true, actions: ["voice_provision_skipped_non_telnyx"] };
  }

  const { provisionMctbTelnyxSipIngress } = await import(
    "@/lib/mctb/provisioning/telnyx-sip-ingress"
  );
  const mctbRole = await resolveMctbProvisionRole(phone.id);
  return provisionMctbTelnyxSipIngress({
    workspaceId: input.workspaceId,
    phoneNumberId: phone.id,
    mctbRole,
  });
}

export async function generateMctbConsentAudio(
  workspaceId: string,
  input?: { scriptText?: string; voiceId?: string; speed?: number },
) {
  const current = await loadMctbConsentPrompt(workspaceId);
  const scriptText = (input?.scriptText ?? current.scriptText).trim();
  const voiceId = input?.voiceId ?? current.voiceId;
  const speed = input?.speed ?? current.speed;

  if (!scriptText) throw new Error("Consent script is required");

  const asset = await generatePromptAudio({
    workspaceId,
    name: "MCTB Consent Prompt",
    text: scriptText,
    voiceId,
    speed,
  });

  const scriptHash = computeConsentScriptHash(scriptText, voiceId, speed);
  const nextVersion = current.publishedVersion + 1;

  return saveMctbConsentPrompt(workspaceId, {
    scriptText,
    voiceId,
    speed,
    audioAssetId: asset.id,
    scriptHash,
    audioStatus: "ready",
    lastGeneratedAt: new Date().toISOString(),
    publishedVersion: nextVersion,
  });
}

export async function publishMctbConsentPrompt(
  workspaceId: string,
  _actorUserId?: string,
  options?: { assignedPhoneNumberId?: string },
) {
  const config = await loadMctbConsentPrompt(workspaceId);
  const gate = canPublishConsentPrompt(config);
  if (!gate.ok) throw new Error(gate.reason || "Cannot publish consent prompt");

  const phoneNumberId = await resolveMctbAssignedPhoneNumberId(
    workspaceId,
    options?.assignedPhoneNumberId,
  );
  if (!phoneNumberId) {
    throw new Error(
      "Select your MCTB number in Setup before publishing consent audio",
    );
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId },
    select: { id: true, settingsJson: true, provider: true },
  });
  if (!phone?.id) {
    throw new Error("Selected MCTB number was not found");
  }

  const now = new Date().toISOString();
  const publishedPatch = {
    publishedAt: now,
    publishedScriptHash: config.scriptHash,
    publishedAudioAssetId: config.audioAssetId,
  };

  await pauseLegacyMctbConsentFlows(workspaceId, phoneNumberId);

  const saved = await saveMctbConsentPrompt(workspaceId, {
    ...publishedPatch,
    flowId: config.flowId,
  });

  const provision =
    isPhoneMctbSipIngress(phone.settingsJson) ||
    String(phone.provider || "").toLowerCase() === "telnyx"
      ? await provisionMctbCallControlVoiceForNumber({ workspaceId, phoneNumberId: phone.id })
      : { ok: true as const };

  if (!provision.ok) {
    throw new Error(provision.error || "mctb_call_control_provision_failed");
  }

  return saved;
}

/** Align consent mode with Call Control voice (press_1 vs existing_consent). */
export async function syncMctbConsentRouting(
  workspaceId: string,
  actorUserId?: string,
  options?: { assignedPhoneNumberId?: string },
) {
  const mode = await loadMctbConsentMode(workspaceId);
  const phoneNumberId = await resolveMctbAssignedPhoneNumberId(
    workspaceId,
    options?.assignedPhoneNumberId,
  );

  await pauseLegacyMctbConsentFlows(workspaceId, phoneNumberId);

  if (mode === "existing_consent") {
    return { mode, action: "call_control_existing_consent" as const };
  }

  const config = await loadMctbConsentPrompt(workspaceId);
  if (!isConsentPromptPublished(config)) {
    return { mode, action: "blocked_unpublished" as const };
  }

  await publishMctbConsentPrompt(workspaceId, actorUserId, {
    assignedPhoneNumberId: options?.assignedPhoneNumberId,
  });
  return { mode, action: "call_control_press1_ready" as const };
}

export async function initMctbConsentPromptForWorkspace(workspaceId: string) {
  const existing = await loadMctbConsentPrompt(workspaceId);
  if (existing.scriptText && existing.audioAssetId) return existing;

  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, displayName: true },
  });
  const businessName = ws?.displayName || ws?.name || "our business";
  const { defaultMctbConsentScript } = await import("./defaults");
  return saveMctbConsentPrompt(workspaceId, {
    scriptText: defaultMctbConsentScript(businessName),
  });
}

export async function getMctbConsentPromptStatus(workspaceId: string) {
  const [config, mode, flow] = await Promise.all([
    loadMctbConsentPrompt(workspaceId),
    loadMctbConsentMode(workspaceId),
    findMctbConsentFlow(workspaceId),
  ]);
  const publishGate = canPublishConsentPrompt(config);
  return {
    config,
    mode,
    flowStatus: flow?.status || null,
    flowId: flow?.id || config.flowId,
    isPublished: isConsentPromptPublished(config),
    canPublish: publishGate.ok,
    publishBlockReason: publishGate.reason || null,
    playbackUrl: config.audioAssetId
      ? `/api/public/smart-routing-audio/${config.audioAssetId}`
      : null,
  };
}

/**
 * Publish consent prompt metadata for the platform demo owner workspace.
 * Voice uses Call Control (mctb-event-only) — same path as production MCTB.
 */
export async function publishPlatformDemoMctbConsent(actorUserId?: string) {
  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  if (!ownerId) throw new Error("Platform demo owner workspace not found");

  const { ensurePlatformDemoSipIngress } = await import("@/lib/mctb/onboarding/platform-demo");
  const sip = await ensurePlatformDemoSipIngress();
  if (!sip.ok) {
    throw new Error(sip.error || "platform_demo_sip_ingress_failed");
  }

  await initMctbConsentPromptForWorkspace(ownerId);
  let config = await loadMctbConsentPrompt(ownerId);
  if (!config.audioAssetId) {
    await generateMctbConsentAudio(ownerId);
    config = await loadMctbConsentPrompt(ownerId);
  }

  const now = new Date().toISOString();
  return saveMctbConsentPrompt(ownerId, {
    publishedAt: now,
    publishedScriptHash: config.scriptHash,
    publishedAudioAssetId: config.audioAssetId,
    flowId: config.flowId,
  });
}
