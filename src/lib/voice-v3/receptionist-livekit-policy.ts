import type { VoiceAgentConfig } from "@/lib/voice/types";
import type { TelephonyProvisionRecord } from "@/lib/telephony/provisioning/types";

function isAppointmentReceptionistAgent(config: VoiceAgentConfig): boolean {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  return advanced.capabilityPack === "appointment_receptionist";
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function readTelephonyProvisionFromSettings(
  settingsJson: unknown,
): TelephonyProvisionRecord {
  const settings = asRecord(settingsJson) || {};
  const prov = asRecord(settings.telephony) || asRecord(settings.provisioning) || {};
  return {
    routingMode: prov.routingMode as TelephonyProvisionRecord["routingMode"],
    state: prov.state as TelephonyProvisionRecord["state"],
    telnyxFqdnConnectionId: prov.telnyxFqdnConnectionId
      ? String(prov.telnyxFqdnConnectionId)
      : undefined,
    livekitInboundTrunkId: prov.livekitInboundTrunkId
      ? String(prov.livekitInboundTrunkId)
      : undefined,
    livekitDidDispatchRuleId: prov.livekitDidDispatchRuleId
      ? String(prov.livekitDidDispatchRuleId)
      : undefined,
    lastError: prov.lastError != null ? String(prov.lastError) : null,
  };
}

export function appointmentReceptionistRequiresLiveKitIngress(
  config: VoiceAgentConfig,
): boolean {
  return isAppointmentReceptionistAgent(config);
}

export function assertAppointmentReceptionistLiveKitPublish(config: VoiceAgentConfig): void {
  if (!isAppointmentReceptionistAgent(config)) return;
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const transport = String(advanced.voiceTransport || advanced.runtimeTransport || "").trim();
  if (transport === "voice_v3_basic" || transport === "telnyx_assistant") {
    throw new Error(
      "AI Receptionist must use Voice V3 LiveKit — Basic and TeXML assistant runtimes are not allowed.",
    );
  }
}

export function isLiveKitSipProvisionActive(provision: TelephonyProvisionRecord): boolean {
  return (
    provision.routingMode === "livekit_sip" &&
    provision.state === "active" &&
    Boolean(provision.livekitInboundTrunkId)
  );
}
