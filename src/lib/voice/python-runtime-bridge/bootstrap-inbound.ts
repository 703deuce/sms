import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { liveKitRuntimeProvider } from "@/lib/voice/runtime-provider/livekit";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { isRealEstateFrontDeskProfile } from "@/lib/voice/frontdesk/agent-config";
import { resolveInboundFrontDeskRouting } from "@/lib/voice/frontdesk/resolve-frontdesk-agent";
import { getReceptionistCompiledFromAdvanced } from "@/lib/voice/receptionist/runtime";
import { hasGenericReceptionistProfile } from "@/lib/voice/receptionist/runtime";
import {
  parseDispatchAttributes,
  parseRoomMetadata,
  type RoomMetadata,
} from "@/lib/telephony/provisioning/metadata";
import { mergeExplicitDispatchMetadata } from "@/lib/telephony/provisioning/dispatch-metadata";
import { loadExplicitDispatchForDid } from "@/lib/telephony/provisioning";
import type { PythonRuntimeBootstrapInput, PythonRuntimeBootstrapResult, PythonRuntimeError } from "./types";

function parseJobMetadata(raw: PythonRuntimeBootstrapInput["jobMetadata"]): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  return raw;
}

function extractCallNumbers(
  attrs: Record<string, string>,
  meta: RoomMetadata | null,
  participantIdentity: string,
): { fromE164?: string; toE164?: string } {
  const fromE164 =
    meta?.fromE164 ||
    attrs["sip.phoneNumber"] ||
    attrs.fromE164 ||
    attrs.callerNumber ||
    participantIdentity;

  const trunkNumber =
    attrs["sip.trunkPhoneNumber"] || attrs["sip.trunkNumber"] || attrs.trunkPhoneNumber;
  const toE164 =
    meta?.toE164 ||
    trunkNumber ||
    attrs["sip.calledNumber"] ||
    attrs.calledNumber ||
    attrs.toE164;

  return { fromE164, toE164 };
}

export async function bootstrapInboundForPython(
  input: PythonRuntimeBootstrapInput,
): Promise<PythonRuntimeBootstrapResult | PythonRuntimeError> {
  const attrs = input.participantAttributes || {};
  const roomMeta =
    typeof input.roomMetadata === "string"
      ? parseRoomMetadata(input.roomMetadata)
      : input.roomMetadata
        ? parseRoomMetadata(JSON.stringify(input.roomMetadata))
        : null;
  const jobMetaRaw = parseJobMetadata(input.jobMetadata);
  const jobMeta = jobMetaRaw
    ? parseDispatchAttributes(JSON.stringify(jobMetaRaw))
    : null;

  const { fromE164, toE164 } = extractCallNumbers(attrs, roomMeta, input.participantIdentity);
  let normalizedTo: string | undefined;
  if (toE164?.trim()) {
    try {
      normalizedTo = normalizeE164(toE164.trim());
    } catch {
      normalizedTo = toE164.trim();
    }
  }

  const didDispatch = normalizedTo ? await loadExplicitDispatchForDid(normalizedTo) : null;
  const explicit = mergeExplicitDispatchMetadata(
    jobMeta ? { ...jobMeta, dispatchSource: "job_metadata" } : null,
    roomMeta ? { ...roomMeta, dispatchSource: "sip_metadata" } : null,
    didDispatch,
  );

  const routing = await resolveInboundFrontDeskRouting({
    workspaceId: explicit?.workspaceId || roomMeta?.workspaceId,
    agentId: explicit?.agentId || roomMeta?.agentId,
    publishedVersionId: explicit?.publishedVersionId || roomMeta?.publishedVersionId,
    toE164: normalizedTo || "",
  });

  const { callId } = await liveKitRuntimeProvider.bootstrapSession({
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    callId: roomMeta?.callId,
    fromE164,
    toE164: normalizedTo || routing.e164,
    livekitRoomName: input.roomName,
    livekitParticipantId: input.participantIdentity,
    lightweightBootstrap: true,
  });

  const prisma = getPrisma();
  const callRow = await prisma.voiceCall.findFirst({
    where: { id: callId, workspaceId: routing.workspaceId },
    select: { agentVersionId: true },
  });

  const pinnedVersionId =
    explicit?.publishedVersionId ||
    routing.publishedVersionId ||
    callRow?.agentVersionId ||
    undefined;

  const { loadVoiceAgentConfigForCall } = await import("@/lib/voice/real-estate/publish");
  const loaded = await loadVoiceAgentConfigForCall({
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    agentVersionId: pinnedVersionId,
  });

  const agentConfig = loaded.config;
  const advanced = agentConfig.advanced as Record<string, unknown> | undefined;
  const isRealEstate = isRealEstateFrontDeskProfile(agentConfig);
  const receptionistCompiled = getReceptionistCompiledFromAdvanced(advanced);
  const isGeneric = hasGenericReceptionistProfile(advanced);

  let runtimeProfile: PythonRuntimeBootstrapResult["runtimeProfile"] = "unsupported";
  if (isGeneric && receptionistCompiled) runtimeProfile = "generic_receptionist";
  else if (isRealEstate) runtimeProfile = "real_estate";

  const realtimeAdvanced = advanced?.realtime as Record<string, unknown> | undefined;
  const calendarAdvanced = advanced?.calendar as Record<string, unknown> | undefined;

  return {
    ok: true,
    callId,
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    agentVersionId: pinnedVersionId,
    callerE164: fromE164,
    toE164: normalizedTo || routing.e164,
    timezone: receptionistCompiled?.timezone || agentConfig.timezone || "America/New_York",
    businessName:
      receptionistCompiled?.businessName?.trim() ||
      agentConfig.businessName?.trim() ||
      routing.agentName ||
      "our office",
    runtimeProfile,
    receptionistCompiled: receptionistCompiled || undefined,
    compiledPrompt: receptionistCompiled?.compiledPrompt,
    greeting: receptionistCompiled?.greeting,
    realtimeModel:
      (typeof realtimeAdvanced?.model === "string" && realtimeAdvanced.model) ||
      process.env.VOICE_REALTIME_MODEL?.trim() ||
      "gpt-realtime-2",
    realtimeVoice:
      (typeof realtimeAdvanced?.voice === "string" && realtimeAdvanced.voice) ||
      process.env.VOICE_REALTIME_VOICE?.trim() ||
      "marin",
    realtimeSpeed:
      typeof realtimeAdvanced?.speed === "number" ? realtimeAdvanced.speed : undefined,
    eventTypeUri:
      typeof calendarAdvanced?.eventTypeUri === "string" ? calendarAdvanced.eventTypeUri : null,
  };
}
