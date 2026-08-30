import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { liveKitRuntimeProvider } from "@/lib/voice/runtime-provider/livekit";
import { isRealEstateFrontDeskProfile } from "@/lib/voice/frontdesk/agent-config";
import { resolveInboundFrontDeskRouting } from "@/lib/voice/frontdesk/resolve-frontdesk-agent";
import { getReceptionistCompiledFromAdvanced } from "@/lib/voice/receptionist/runtime";
import { hasGenericReceptionistProfile } from "@/lib/voice/receptionist/runtime";
import {
  parseDispatchAttributes,
  parseRoomMetadata,
  type RoomMetadata,
} from "@/lib/telephony/provisioning/metadata";
import { loadExplicitDispatchForDid, mergeExplicitDispatchMetadata } from "@/lib/telephony/provisioning";
import {
  getLiveKitAgentTemplateFromAdvanced,
  normalizeAgentTemplateId,
} from "@/lib/voice/templates/agent-template-config";
import {
  isLabLiveKitTemplate,
  slimReceptionistCompiledForBootstrap,
} from "@/lib/voice/python-runtime-bridge/bootstrap-payload";
import {
  buildPythonRuntimeBootstrapSnapshot,
  getPythonRuntimeBootstrapSnapshot,
} from "@/lib/voice/python-runtime-bridge/build-bootstrap-snapshot";
import type { PythonRuntimeBootstrapInput, PythonRuntimeBootstrapResult, PythonRuntimeError } from "./types";
import {
  parseMediaBackend,
  resolveMediaBackend,
} from "@/lib/voice/media-backend/resolver";
import { pinMediaBackendOnCall } from "@/lib/voice/media-backend/pinning";
import { resolvePlatformOutboundTrunkId } from "@/lib/telephony/provisioning/livekit/outbound-trunk";

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

function logBootstrapProfile(
  callId: string | undefined,
  steps: Record<string, number>,
  totalMs: number,
  extra: Record<string, unknown> = {},
) {
  console.log(
    JSON.stringify({
      service: "transovo-web",
      event: "bootstrap_inbound_profile",
      callId,
      totalMs,
      steps,
      timestamp: new Date().toISOString(),
      ...extra,
    }),
  );
}

function buildBootstrapFromConfig(input: {
  callId: string;
  fromE164?: string;
  toE164?: string;
  routing: Awaited<ReturnType<typeof resolveInboundFrontDeskRouting>>;
  pinnedVersionId?: string;
  agentConfig: import("@/lib/voice/types").VoiceAgentConfig;
  sipOutboundTrunkId: string | null;
  jobMetaRaw: Record<string, unknown> | null;
  roomMeta: RoomMetadata | null;
  explicitTemplate?: string;
}): PythonRuntimeBootstrapResult {
  const advanced = input.agentConfig.advanced as Record<string, unknown> | undefined;
  const receptionistCompiled = getReceptionistCompiledFromAdvanced(advanced);
  const isRealEstate = isRealEstateFrontDeskProfile(input.agentConfig);
  const isGeneric = hasGenericReceptionistProfile(advanced);

  let runtimeProfile: PythonRuntimeBootstrapResult["runtimeProfile"] = "unsupported";
  if (isGeneric && receptionistCompiled) runtimeProfile = "generic_receptionist";
  else if (isRealEstate) runtimeProfile = "real_estate";

  const jobTemplate =
    typeof input.jobMetaRaw?.agentTemplate === "string" ? input.jobMetaRaw.agentTemplate.trim() : "";
  const roomTemplate =
    typeof input.roomMeta?.agentTemplate === "string" ? input.roomMeta.agentTemplate.trim() : "";
  const configTemplate = getLiveKitAgentTemplateFromAdvanced(advanced);
  const envTemplate = process.env.VOICE_ACTIVE_TEMPLATE?.trim() || "";
  const defaultTemplate = "livekit_basic_voice";
  const agentTemplate = normalizeAgentTemplateId(
    input.explicitTemplate ||
      jobTemplate ||
      roomTemplate ||
      envTemplate ||
      configTemplate ||
      defaultTemplate,
  );

  const realtimeAdvanced = advanced?.realtime as Record<string, unknown> | undefined;
  const calendarAdvanced = advanced?.calendar as Record<string, unknown> | undefined;
  const useSlimBootstrap = isLabLiveKitTemplate(agentTemplate);
  const bootstrapCompiled =
    receptionistCompiled && useSlimBootstrap
      ? slimReceptionistCompiledForBootstrap(receptionistCompiled)
      : receptionistCompiled;

  return {
    ok: true,
    apiVersion: 1,
    callId: input.callId,
    workspaceId: input.routing.workspaceId,
    agentId: input.routing.agentId,
    agentVersionId: input.pinnedVersionId,
    callerE164: input.fromE164,
    toE164: input.toE164 || input.routing.e164,
    timezone:
      receptionistCompiled?.timezone ||
      (typeof calendarAdvanced?.timezone === "string" ? calendarAdvanced.timezone : undefined) ||
      "America/New_York",
    businessName:
      receptionistCompiled?.businessName?.trim() ||
      input.agentConfig.identity?.displayName?.trim() ||
      input.routing.agentName ||
      "our office",
    runtimeProfile,
    agentTemplate,
    agentTemplateVersion: "1",
    runtime: "livekit_python",
    receptionistCompiled: bootstrapCompiled || undefined,
    compiledPrompt: useSlimBootstrap ? undefined : receptionistCompiled?.compiledPrompt,
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
    sipOutboundTrunkId: input.sipOutboundTrunkId,
    sipCallerIdE164: input.toE164 || input.routing.e164 || null,
  };
}

export async function bootstrapInboundForPython(
  input: PythonRuntimeBootstrapInput,
): Promise<PythonRuntimeBootstrapResult | PythonRuntimeError> {
  const started = Date.now();
  const steps: Record<string, number> = {};
  const mark = (name: string, since: number) => {
    steps[name] = Date.now() - since;
  };

  const attrs = input.participantAttributes || {};
  const roomMeta =
    typeof input.roomMetadata === "string"
      ? parseRoomMetadata(input.roomMetadata)
      : input.roomMetadata
        ? parseRoomMetadata(JSON.stringify(input.roomMetadata))
        : null;
  const jobMetaRaw = parseJobMetadata(input.jobMetadata);
  const jobMeta = jobMetaRaw
    ? parseDispatchAttributes(
        Object.fromEntries(
          Object.entries(jobMetaRaw).flatMap(([key, value]) =>
            value === undefined || value === null ? [] : [[key, String(value)]],
          ),
        ),
      )
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

  const mediaBackend = await resolveMediaBackend({
    callId: input.predeterminedCallId || roomMeta?.callId,
    mediaBackend:
      parseMediaBackend(jobMetaRaw?.mediaBackend) ||
      parseMediaBackend((roomMeta as { mediaBackend?: unknown } | null)?.mediaBackend),
  });

  let t = Date.now();
  const didDispatch = normalizedTo ? await loadExplicitDispatchForDid(normalizedTo) : null;
  mark("did_dispatch", t);

  t = Date.now();
  const explicit = mergeExplicitDispatchMetadata(
    jobMeta ? { ...jobMeta, dispatchSource: "job_metadata" } : null,
    roomMeta ? { ...roomMeta, dispatchSource: "sip_metadata" } : null,
    didDispatch,
  );
  mark("merge_dispatch_metadata", t);

  t = Date.now();
  const routing = await resolveInboundFrontDeskRouting({
    workspaceId: explicit?.workspaceId || roomMeta?.workspaceId,
    agentId: explicit?.agentId || roomMeta?.agentId,
    publishedVersionId: explicit?.publishedVersionId || roomMeta?.publishedVersionId,
    toE164: normalizedTo || "",
  });
  mark("resolve_routing", t);

  const pinnedVersionId =
    explicit?.publishedVersionId || routing.publishedVersionId || undefined;

  t = Date.now();
  const { loadVoiceAgentConfigForCall } = await import("@/lib/voice/real-estate/publish");
  const [{ callId }, loaded] = await Promise.all([
    liveKitRuntimeProvider.bootstrapSession({
      workspaceId: routing.workspaceId,
      agentId: routing.agentId,
      callId: input.predeterminedCallId || roomMeta?.callId,
      fromE164,
      toE164: normalizedTo || routing.e164,
      livekitRoomName: input.roomName,
      livekitParticipantId: input.participantIdentity,
      lightweightBootstrap: true,
      mediaBackend,
    }),
    loadVoiceAgentConfigForCall({
      workspaceId: routing.workspaceId,
      agentId: routing.agentId,
      agentVersionId: pinnedVersionId,
    }),
  ]);
  mark("parallel_call_create_config", t);

  await pinMediaBackendOnCall({ callId, mediaBackend });
  const sipOutboundTrunkId = await resolvePlatformOutboundTrunkId({
    callerIdE164: normalizedTo || routing.e164,
    backend: mediaBackend,
  });

  const snapshot =
    getPythonRuntimeBootstrapSnapshot(
      loaded.config.advanced as Record<string, unknown> | undefined,
    ) ||
    buildPythonRuntimeBootstrapSnapshot(loaded.config, {
      workspaceId: routing.workspaceId,
      agentId: routing.agentId,
      agentName: routing.agentName,
    });
  let result: PythonRuntimeBootstrapResult;

  if (snapshot) {
    t = Date.now();
    result = {
      ok: true,
      apiVersion: 1,
      callId,
      workspaceId: snapshot.workspaceId,
      agentId: snapshot.agentId,
      agentVersionId: pinnedVersionId || loaded.agentVersionId || snapshot.agentVersionId,
      callerE164: fromE164,
      toE164: normalizedTo || routing.e164,
      timezone: snapshot.timezone,
      businessName: snapshot.businessName,
      runtimeProfile: snapshot.runtimeProfile,
      agentTemplate: snapshot.agentTemplate,
      agentTemplateVersion: snapshot.agentTemplateVersion,
      runtime: snapshot.runtime,
      receptionistCompiled: snapshot.receptionistCompiled,
      compiledPrompt: snapshot.compiledPrompt,
      greeting: snapshot.greeting,
      realtimeModel: snapshot.realtimeModel,
      realtimeVoice: snapshot.realtimeVoice,
      realtimeSpeed: snapshot.realtimeSpeed,
      eventTypeUri: snapshot.eventTypeUri,
      sipOutboundTrunkId,
      sipCallerIdE164: normalizedTo || routing.e164 || null,
    };
    mark("snapshot_fast_path", t);
    logBootstrapProfile(callId, steps, Date.now() - started, {
      path: "snapshot",
      agentTemplate: result.agentTemplate,
      payloadBytes: JSON.stringify(result).length,
      mediaBackend,
    });
    return {
      ...result,
      bootstrapPath: "snapshot",
      bootstrapProfileMs: Date.now() - started,
    };
  }

  t = Date.now();
  result = buildBootstrapFromConfig({
    callId,
    fromE164,
    toE164: normalizedTo,
    routing,
    pinnedVersionId: pinnedVersionId || loaded.agentVersionId || undefined,
    agentConfig: loaded.config,
    sipOutboundTrunkId,
    jobMetaRaw,
    roomMeta,
    explicitTemplate: typeof explicit?.agentTemplate === "string" ? explicit.agentTemplate : undefined,
  });
  mark("build_bootstrap_payload", t);

  logBootstrapProfile(callId, steps, Date.now() - started, {
    path: "compiled",
    agentTemplate: result.agentTemplate,
    payloadBytes: JSON.stringify(result).length,
    mediaBackend,
  });

  return {
    ...result,
    bootstrapPath: "compiled",
    bootstrapProfileMs: Date.now() - started,
  };
}
