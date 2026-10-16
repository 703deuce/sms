import type { VoiceAgentConfig } from "@/lib/voice/types";
import { isRealEstateFrontDeskProfile } from "@/lib/voice/frontdesk/agent-config";
import { getReceptionistCompiledFromAdvanced } from "@/lib/voice/receptionist/runtime";
import { hasGenericReceptionistProfile } from "@/lib/voice/receptionist/runtime";
import {
  getLiveKitAgentTemplateFromAdvanced,
  normalizeAgentTemplateId,
} from "@/lib/voice/templates/agent-template-config";
import {
  isLabLiveKitTemplate,
  slimReceptionistCompiledForBootstrap,
} from "@/lib/voice/python-runtime-bridge/bootstrap-payload";
import type { PythonRuntimeBootstrapResult } from "./types";
import { receptionistLog } from "@/lib/solutions/appointment-receptionist/config-tracing/log";

export const PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY = "pythonRuntimeBootstrapSnapshot";

export type PythonRuntimeBootstrapSnapshot = Omit<
  PythonRuntimeBootstrapResult,
  "ok" | "callId" | "callerE164" | "toE164" | "sipOutboundTrunkId" | "sipCallerIdE164"
> & {
  snapshotVersion: 1;
  builtAt: string;
};

export function getPythonRuntimeBootstrapSnapshot(
  advanced: Record<string, unknown> | undefined,
): PythonRuntimeBootstrapSnapshot | null {
  const raw = advanced?.[PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY];
  if (!raw || typeof raw !== "object") return null;
  const snap = raw as PythonRuntimeBootstrapSnapshot;
  if (snap.snapshotVersion !== 1 || snap.apiVersion !== 1) return null;
  return snap;
}

/** Build a call-ready bootstrap payload at publish/save time — no DB I/O. */
export function buildPythonRuntimeBootstrapSnapshot(
  config: VoiceAgentConfig,
  ctx: { workspaceId: string; agentId: string; agentName?: string },
): PythonRuntimeBootstrapSnapshot | null {
  const advanced = config.advanced as Record<string, unknown> | undefined;
  const receptionistCompiled = getReceptionistCompiledFromAdvanced(advanced);
  const isRealEstate = isRealEstateFrontDeskProfile(config);
  const isGeneric = hasGenericReceptionistProfile(advanced);

  let runtimeProfile: PythonRuntimeBootstrapResult["runtimeProfile"] = "unsupported";
  if (isGeneric && receptionistCompiled) runtimeProfile = "generic_receptionist";
  else if (isRealEstate) runtimeProfile = "real_estate";

  const envTemplate = process.env.VOICE_ACTIVE_TEMPLATE?.trim() || "";
  const defaultTemplate = "livekit_basic_voice";
  const agentTemplate = normalizeAgentTemplateId(
    getLiveKitAgentTemplateFromAdvanced(advanced) || envTemplate || defaultTemplate,
  );

  const realtimeAdvanced = advanced?.realtime as Record<string, unknown> | undefined;
  const calendarAdvanced = advanced?.calendar as Record<string, unknown> | undefined;
  const useSlimBootstrap = isLabLiveKitTemplate(agentTemplate);
  const bootstrapCompiled =
    receptionistCompiled && useSlimBootstrap
      ? slimReceptionistCompiledForBootstrap(receptionistCompiled)
      : receptionistCompiled;

  return {
    snapshotVersion: 1,
    builtAt: new Date().toISOString(),
    apiVersion: 1,
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    agentVersionId: undefined,
    timezone:
      receptionistCompiled?.timezone ||
      (typeof calendarAdvanced?.timezone === "string" ? calendarAdvanced.timezone : undefined) ||
      "America/New_York",
    businessName:
      receptionistCompiled?.businessName?.trim() ||
      config.identity?.displayName?.trim() ||
      ctx.agentName?.trim() ||
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
  };
}

export function attachPythonRuntimeBootstrapSnapshot(
  config: VoiceAgentConfig,
  ctx: { workspaceId: string; agentId: string; agentName?: string },
): VoiceAgentConfig {
  const snapshot = buildPythonRuntimeBootstrapSnapshot(config, ctx);
  if (!snapshot) return config;
  receptionistLog("RUNTIME_COMPILE", "BOOTSTRAP_SNAPSHOT", {
    agent: ctx.agentId,
    runtime_profile: snapshot.runtimeProfile,
    agent_template: snapshot.agentTemplate,
    mode: "publish",
  });
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  return {
    ...config,
    advanced: {
      ...advanced,
      [PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY]: snapshot,
    },
  };
}
