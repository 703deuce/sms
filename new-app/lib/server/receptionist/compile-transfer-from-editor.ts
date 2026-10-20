import type { AgentConfig } from "@/lib/agent";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { getStoredLiveKitOutboundTrunkId } from "@/lib/telephony/provisioning/livekit/outbound-trunk";
import { mapWizardTransferFallback } from "@/lib/server/voice-v3/transfer/map-fallback";
import { transferTriggerPhrasesFromEditor } from "@/lib/server/receptionist/transfer-triggers-from-editor";
import type {
  VoiceV3TransferDestinationCompiled,
  VoiceV3TransferPolicyCompiled,
  VoiceV3TransferRouteCompiled,
  VoiceV3TransferMode,
} from "@/lib/server/voice-v3/transfer/types";

function wizardMode(stepMode: "BASIC" | "WARM" | undefined, defaultWarm: boolean): VoiceV3TransferMode {
  if (stepMode === "WARM") return "WARM";
  if (stepMode === "BASIC") return "DIRECT";
  return defaultWarm ? "WARM" : "DIRECT";
}

function destinationsFromEditor(
  editor: AgentConfig,
  defaultTimeout: number,
  defaultWarm: boolean,
): VoiceV3TransferDestinationCompiled[] {
  const out: VoiceV3TransferDestinationCompiled[] = [];
  for (const d of editor.transfers) {
    if (!d.enabled) continue;
    const raw = d.number?.trim();
    if (!raw) continue;
    let phoneE164 = raw;
    try {
      phoneE164 = normalizeE164(raw);
    } catch {
      continue;
    }
    out.push({
      id: d.id,
      label: d.name?.trim() || "Destination",
      description: d.reason?.trim() || undefined,
      phoneE164,
      defaultMode: defaultWarm ? "WARM" : "DIRECT",
      ringingTimeoutSeconds: defaultTimeout,
      enabled: true,
    });
  }
  return out;
}

function routeDescription(editor: AgentConfig): string {
  const phrases = transferTriggerPhrasesFromEditor(editor);
  if (phrases.length) return phrases.join(" ");
  return "Use when the caller asks to speak with a configured person or department, or when business policy requires human escalation.";
}

function mapGlobalFallback(fb: AgentConfig["transferAdvanced"]["globalFallback"]): string {
  switch (fb) {
    case "callback":
      return "callback";
    case "message":
      return "take_message";
    case "end":
      return "end_call";
    case "backup":
    default:
      return "return_to_ai";
  }
}

export function compileVoiceV3TransferPolicyFromEditor(editor: AgentConfig): VoiceV3TransferPolicyCompiled {
  const adv = editor.transferAdvanced;
  const enabled =
    editor.capabilities.transfer === true && adv.humanTransferEnabled !== false;
  const defaultTimeout = Math.max(5, adv.ringSeconds ?? 30);
  const defaultWarm = editor.transferStyle === "warm";
  const destinations = destinationsFromEditor(editor, defaultTimeout, defaultWarm);
  const destById = new Map(destinations.map((d) => [d.id, d]));
  const fallback = mapWizardTransferFallback(mapGlobalFallback(adv.globalFallback));
  const routing = adv.routing === "waterfall" ? "waterfall" : "single";

  const steps =
    adv.planSteps?.length
      ? adv.planSteps
      : destinations.map((d, i) => ({
          order: i + 1,
          destinationId: d.id,
          transferMode: defaultWarm ? "WARM" : "BASIC",
          timeoutSeconds: defaultTimeout,
        }));

  const targets = steps
    .filter((s) => destById.has(s.destinationId))
    .map((s, i) => ({
      destinationId: s.destinationId,
      mode: wizardMode(s.transferMode, defaultWarm),
      ringingTimeoutSeconds: Math.max(5, s.timeoutSeconds ?? defaultTimeout),
      order: s.order ?? i + 1,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(({ destinationId, mode, ringingTimeoutSeconds }) => ({
      destinationId,
      mode,
      ringingTimeoutSeconds,
    }));

  const limitedTargets =
    routing === "single" && targets.length > 0 ? [targets[0]] : targets.slice(0, 8);

  const routeId = "default_transfer_route";
  const routes: VoiceV3TransferRouteCompiled[] =
    limitedTargets.length > 0
      ? [
          {
            id: routeId,
            label: "Default transfer route",
            description: routeDescription(editor),
            targets: limitedTargets,
            fallback,
          },
        ]
      : [];

  return {
    enabled: enabled && destinations.length > 0 && routes.length > 0,
    defaultRingingTimeoutSeconds: defaultTimeout,
    defaultFallback: fallback,
    routing,
    destinations,
    routes,
    telephony: {
      outboundSipTrunkId: getStoredLiveKitOutboundTrunkId(),
      outboundCallerIdE164: null,
    },
  };
}
