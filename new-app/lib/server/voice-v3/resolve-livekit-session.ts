import "server-only";

import { getPrisma } from "@/lib/server/db";
import { compilePublishedBundle } from "@/lib/server/receptionist/compile-runtime";
import { loadLiveEditorFromPublished } from "@/lib/server/receptionist/agent-store";
import type { ReceptionistPublishedBundle } from "@/lib/server/receptionist/draft-types";
import { putLiveSession } from "@/lib/server/receptionist/runtime/session-store";
import type { LiveKitBootstrapPayload } from "@/lib/server/receptionist/runtime/session";
import {
  isSipParticipantDialedE164Source,
  isTrustedInboundDialedE164Source,
  productionRequiresSipDialAttribution,
} from "@/lib/server/receptionist/livekit/canonical-dispatch-helpers";
import {
  normalizeE164,
  resolveReceptionistByCalledNumber,
} from "@/lib/server/receptionist/routing-resolve";

const BROWSER_TEST_PREFIX =
  process.env.LIVEKIT_BROWSER_TEST_ROOM_PREFIX?.trim() || "transovo-browser-test-";

function liveSessionIdForRoom(roomName: string): string {
  const room = roomName.trim();
  return room.startsWith("lk_") ? room : `lk_${room}`;
}

function assertInboundSipBootstrapTrust(payload: LiveKitBootstrapPayload, roomName: string): void {
  const isBrowserTest = roomName.startsWith(BROWSER_TEST_PREFIX);
  if (isBrowserTest) return;

  if (payload.workspaceId || payload.agentId || payload.useDraft) {
    throw new Error(
      "Inbound SIP session resolve rejects workspace/agent hints — use called DID routing only",
    );
  }

  if (payload.bootstrapPath !== "livekit_sip") {
    throw new Error(
      "Inbound SIP resolve requires bootstrapPath livekit_sip from authenticated transovo-voice-v3 worker",
    );
  }

  const dialed = payload.dialedE164?.trim();
  if (!dialed) throw new Error("dialedE164 is required for inbound SIP");

  const sipIdentity = payload.sipParticipantIdentity?.trim();
  if (!sipIdentity) {
    throw new Error("sipParticipantIdentity is required for inbound SIP");
  }

  const source = payload.dialedE164Source?.trim();
  if (productionRequiresSipDialAttribution()) {
    if (!source) {
      throw new Error(
        "dialedE164Source is required for production PSTN (SIP participant attributes from LiveKit)",
      );
    }
    if (!isSipParticipantDialedE164Source(source)) {
      throw new Error(
        `Production PSTN requires SIP-participant dialed attribution (e.g. sip.trunkPhoneNumber), not: ${source}`,
      );
    }
  } else if (source && !isTrustedInboundDialedE164Source(source)) {
    throw new Error(`Untrusted dialedE164Source: ${source}`);
  }
}

async function loadPublishedBundle(
  workspaceId: string,
  agentId: string,
  publishedVersionId: string,
): Promise<ReceptionistPublishedBundle> {
  const prisma = getPrisma();
  const version = await prisma.voiceAgentVersion.findFirst({
    where: { id: publishedVersionId, workspaceId, agentId },
  });
  if (!version?.config) throw new Error("Published version config missing");
  const config = version.config as Record<string, unknown>;
  const nested = config.newAppReceptionist as ReceptionistPublishedBundle | undefined;
  if (nested?.runtime?.toolNames?.length) return nested;

  const editor = loadLiveEditorFromPublished(version.config, nested?.editor || ({} as never));
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });
  return compilePublishedBundle({
    editor,
    workspaceId,
    businessName: workspace?.name || "your business",
  });
}

export async function resolveNativeVoiceV3LiveKitSession(payload: LiveKitBootstrapPayload) {
  const dialed = payload.dialedE164?.trim();
  const roomName = payload.roomName?.trim();
  if (!roomName) throw new Error("roomName is required");

  const isBrowserTest = roomName.startsWith(BROWSER_TEST_PREFIX);
  assertInboundSipBootstrapTrust(payload, roomName);
  const prisma = getPrisma();

  let workspaceId: string;
  let agentId: string;
  let phoneNumberId: string;
  let bundle: ReceptionistPublishedBundle;
  let configSource: "published" | "draft_test" = "published";
  let publishedVersionId: string | null = null;

  if (isBrowserTest) {
    const meta = payload as LiveKitBootstrapPayload & {
      workspaceId?: string;
      agentId?: string;
      useDraft?: boolean;
    };
    if (!meta.workspaceId || !meta.agentId) {
      throw new Error("Browser test session requires workspaceId and agentId in bootstrap metadata");
    }
    workspaceId = meta.workspaceId;
    agentId = meta.agentId;
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: agentId, workspaceId },
    });
    if (!agent) throw new Error("Agent not found");
    phoneNumberId = agent.phoneNumberId || "";
    configSource = meta.useDraft ? "draft_test" : "published";
    if (configSource === "draft_test") {
      const draft = loadLiveEditorFromPublished(agent.draftConfig, {} as never);
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      });
      bundle = compilePublishedBundle({
        editor: draft,
        workspaceId,
        businessName: workspace?.name || "your business",
      });
    } else {
      if (!agent.publishedVersionId) throw new Error("Publish the agent before live browser test");
      publishedVersionId = agent.publishedVersionId;
      bundle = await loadPublishedBundle(workspaceId, agentId, publishedVersionId);
    }
  } else {
    if (!dialed) throw new Error("dialedE164 is required for inbound SIP");
    const routing = await resolveReceptionistByCalledNumber(dialed);
    if (!routing || routing.paused) throw new Error(`No active receptionist for ${dialed}`);

    const normalizedDialed = normalizeE164(dialed);
    const ownedPhone = await prisma.phoneNumber.findFirst({
      where: {
        id: routing.phoneNumberId,
        workspaceId: routing.workspaceId,
        e164: normalizedDialed,
        status: "Active",
      },
      select: { id: true },
    });
    if (!ownedPhone) {
      throw new Error("Called number does not match workspace receptionist assignment");
    }

    workspaceId = routing.workspaceId;
    agentId = routing.agentId;
    phoneNumberId = routing.phoneNumberId;

    const agent = await prisma.voiceAgent.findFirst({
      where: { id: agentId, workspaceId },
    });
    if (!agent?.publishedVersionId) {
      throw new Error("Receptionist is not published — inbound calls require a published version");
    }
    publishedVersionId = agent.publishedVersionId;
    bundle = await loadPublishedBundle(workspaceId, agentId, publishedVersionId);
  }

  const liveSessionId = liveSessionIdForRoom(roomName);
  const callId = liveSessionId;
  const rt = bundle.runtime;

  const callerE164 = payload.callerE164?.trim();
  putLiveSession({
    liveSessionId,
    callId,
    workspaceId,
    agentId,
    phoneNumberId,
    bundle,
    intake: callerE164 ? { inbound_caller_e164: callerE164 } : {},
    configSource,
    publishedVersionId,
    scheduling: {},
  });

  await prisma.voiceCall
    .create({
      data: {
        id: callId,
        workspaceId,
        agentId,
        direction: "INBOUND",
        status: "IN_PROGRESS",
        fromE164: payload.callerE164?.trim() || (isBrowserTest ? "browser-tester" : "unknown"),
        toE164: dialed || "browser-test",
        phoneNumberId: phoneNumberId || undefined,
        metadata: {
          liveSessionId,
          roomName,
          configSource,
          publishedVersionId,
        },
      },
    })
    .catch(() => undefined);

  return {
    liveSessionId,
    callId,
    workspaceId,
    agentId,
    phoneNumberId,
    amyInstructions: rt.amyInstructions,
    astraInstructions: rt.astraInstructions,
    astraModel: rt.astraModel,
    liveVoiceId: rt.liveVoiceId,
    toolSchemas: rt.toolNames.map((name) => ({
      type: "function",
      name,
      description: name,
      parameters: { type: "object", properties: {} },
    })),
    toolNames: rt.toolNames,
    intakeFields: bundle.editor.intake.map((f) => ({
      key: f.id,
      label: f.label,
      required: f.required,
    })),
    parallelToolCalls: false,
    maxToolSteps: rt.maxToolSteps,
    reasoningEffort: "low",
    textVerbosity: "low",
    openaiFileSearchVectorStoreIds: rt.openaiFileSearchVectorStoreIds,
  };
}
