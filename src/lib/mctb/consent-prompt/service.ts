import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { generatePromptAudio } from "@/lib/smart-routing/media-service";
import {
  createFlow,
  pauseFlow,
  publishFlow,
  updateFlowDraft,
} from "@/lib/smart-routing/flow-service";
import { templateForType } from "@/lib/smart-routing/templates";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { resolvePlatformDemoOwnerWorkspaceId, preparePlatformDemoNumberForSmartRouting } from "@/lib/mctb/onboarding/platform-demo";
import type { DraftConfig } from "@/lib/smart-routing/types";
import {
  canPublishConsentPrompt,
  computeConsentScriptHash,
  isConsentPromptPublished,
  loadMctbConsentPrompt,
  saveMctbConsentPrompt,
} from "./store";
import { MCTB_CONSENT_FLOW_NAME } from "./types";

export type MctbConsentMode = "press_1" | "existing_consent";

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
  const mode = String(mctb.consentMode || "press_1");
  return mode === "existing_consent" ? "existing_consent" : "press_1";
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

function buildConsentFlowDraft(input: {
  scriptText: string;
  audioAssetId: string;
  promptVersion: number;
  scriptHash: string;
}): DraftConfig {
  const template = templateForType("missed_call_recovery");
  const draft: DraftConfig = JSON.parse(JSON.stringify(template.draftConfig)) as DraftConfig;
  const consentNode = draft.nodes?.find((n) => n.type === "SMS_CONSENT");
  if (consentNode) {
    consentNode.config = {
      ...consentNode.config,
      consentDigit: "1",
      promptText: input.scriptText,
      promptAssetId: input.audioAssetId,
      audioAssetId: input.audioAssetId,
      promptVersion: String(input.promptVersion),
      promptScriptHash: input.scriptHash,
    };
  }
  draft.greeting = {
    source: "elevenlabs",
    text: input.scriptText,
    audioAssetId: input.audioAssetId,
  };
  draft.metadata = { ...(draft.metadata || {}), mctbManaged: true, purpose: "verified_consent" };
  return draft;
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
  actorUserId?: string,
  options?: { assignedPhoneNumberId?: string },
) {
  const config = await loadMctbConsentPrompt(workspaceId);
  const gate = canPublishConsentPrompt(config);
  if (!gate.ok) throw new Error(gate.reason || "Cannot publish consent prompt");

  const phoneNumberId =
    options?.assignedPhoneNumberId || (await resolveWorkspaceTfnPhoneNumberId(workspaceId));
  if (!phoneNumberId) {
    throw new Error("Assign a workspace toll-free number before publishing consent audio");
  }

  const version = config.publishedVersion || 1;
  const draft = buildConsentFlowDraft({
    scriptText: config.scriptText,
    audioAssetId: config.audioAssetId!,
    promptVersion: version,
    scriptHash: config.scriptHash!,
  });

  let flow = await findMctbConsentFlow(workspaceId);
  if (!flow) {
    flow = await createFlow(workspaceId, {
      name: MCTB_CONSENT_FLOW_NAME,
      type: "missed_call_recovery",
      createdBy: actorUserId,
    });
  }

  await updateFlowDraft(workspaceId, flow.id, {
    draftConfig: draft,
    assignedPhoneNumberId: phoneNumberId,
    status: "draft",
  });

  await publishFlow(workspaceId, flow.id, actorUserId);

  const now = new Date().toISOString();
  return saveMctbConsentPrompt(workspaceId, {
    publishedAt: now,
    publishedScriptHash: config.scriptHash,
    publishedAudioAssetId: config.audioAssetId,
    flowId: flow.id,
  });
}

/** Keep Smart Routing flow aligned with consent mode (press_1 vs existing_consent). */
export async function syncMctbConsentRouting(workspaceId: string, actorUserId?: string) {
  const mode = await loadMctbConsentMode(workspaceId);
  const flow = await findMctbConsentFlow(workspaceId);

  if (mode === "existing_consent") {
    if (flow && flow.status === "active") {
      await pauseFlow(workspaceId, flow.id);
    }
    return { mode, action: "paused_consent_flow" as const };
  }

  const config = await loadMctbConsentPrompt(workspaceId);
  if (!isConsentPromptPublished(config)) {
    if (flow && flow.status === "active") {
      await pauseFlow(workspaceId, flow.id);
    }
    return { mode, action: "blocked_unpublished" as const };
  }

  await publishMctbConsentPrompt(workspaceId, actorUserId);
  return { mode, action: "published_consent_flow" as const };
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
 * Publish Verified Call Consent smart routing on the platform Telnyx 571 line.
 * Required for Pass 3 certification — real DTMF Press-1 on the platform DID.
 */
export async function publishPlatformDemoMctbConsent(actorUserId?: string) {
  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  if (!ownerId) throw new Error("Platform demo owner workspace not found");

  const { phoneNumberId } = await preparePlatformDemoNumberForSmartRouting();

  await initMctbConsentPromptForWorkspace(ownerId);
  const config = await loadMctbConsentPrompt(ownerId);
  if (!config.audioAssetId) {
    await generateMctbConsentAudio(ownerId);
  }

  return publishMctbConsentPrompt(ownerId, actorUserId, {
    assignedPhoneNumberId: phoneNumberId,
  });
}
