import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getStoredLiveKitOutboundTrunkId } from "@/lib/telephony/provisioning/livekit/outbound-trunk";
import { mapWizardTransferFallback } from "./map-fallback";
import type {
  VoiceV3TransferDestinationCompiled,
  VoiceV3TransferPolicyCompiled,
  VoiceV3TransferRouteCompiled,
  VoiceV3TransferMode,
} from "./types";

function wizardMode(
  stepMode: "BASIC" | "WARM" | undefined,
  defaultWarm: boolean,
): VoiceV3TransferMode {
  if (stepMode === "WARM") return "WARM";
  if (stepMode === "BASIC") return "DIRECT";
  return defaultWarm ? "WARM" : "DIRECT";
}

function destinationsFromWizard(
  wizard: AppointmentReceptionistWizardState,
  defaultTimeout: number,
  defaultWarm: boolean,
): VoiceV3TransferDestinationCompiled[] {
  const rows = wizard.transferDestinations?.filter((d) => d.enabled !== false) ?? [];
  const out: VoiceV3TransferDestinationCompiled[] = [];
  for (const d of rows) {
    const raw = d.phoneE164?.trim() || "";
    if (!raw) continue;
    let phoneE164 = raw;
    try {
      phoneE164 = normalizeE164(raw);
    } catch {
      continue;
    }
    out.push({
      id: d.id,
      label: d.label?.trim() || "Destination",
      description: d.label?.trim() || undefined,
      phoneE164,
      defaultMode: defaultWarm ? "WARM" : "DIRECT",
      ringingTimeoutSeconds: defaultTimeout,
      enabled: d.enabled !== false,
    });
  }
  if (out.length) return out;

  const legacy = wizard.transferDestinationPhone?.trim();
  if (!legacy) return [];
  try {
    const phoneE164 = normalizeE164(legacy);
    return [
      {
        id: "default_transfer",
        label: wizard.transferDestinationName?.trim() || "Team",
        phoneE164,
        defaultMode: defaultWarm ? "WARM" : "DIRECT",
        ringingTimeoutSeconds: defaultTimeout,
        enabled: true,
      },
    ];
  } catch {
    return [];
  }
}

function routeDescription(wizard: AppointmentReceptionistWizardState): string {
  const triggers = (wizard.transferTriggers ?? []).map((t) => t.trim()).filter(Boolean);
  if (triggers.length) return triggers.join(" ");
  return "Use when the caller asks to speak with a configured person or department, or when business policy requires human escalation.";
}

export function compileVoiceV3TransferPolicyFromWizard(
  wizard: AppointmentReceptionistWizardState,
): VoiceV3TransferPolicyCompiled {
  const enabled =
    wizard.capabilities?.includes("transfer_calls") === true &&
    wizard.voiceV2HumanTransferEnabled !== false;
  const defaultTimeout = Math.max(5, wizard.transferRingSeconds ?? 30);
  const defaultWarm = wizard.warmTransfer === true;
  const destinations = destinationsFromWizard(wizard, defaultTimeout, defaultWarm);
  const destById = new Map(destinations.map((d) => [d.id, d]));
  const fallback = mapWizardTransferFallback(wizard.transferFallback);
  const routing = wizard.transferRouting === "waterfall" ? "waterfall" : "single";

  const steps =
    wizard.transferPlanSteps?.length
      ? wizard.transferPlanSteps
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

  const routeId = wizard.defaultTransferPlanId?.trim() || "default_transfer_route";
  const routes: VoiceV3TransferRouteCompiled[] =
    limitedTargets.length > 0
      ? [
          {
            id: routeId,
            label: "Default transfer route",
            description: routeDescription(wizard),
            targets: limitedTargets,
            fallback,
          },
        ]
      : [];

  let outboundCaller: string | null = wizard.outboundSmsE164?.trim() || wizard.phoneNumberE164?.trim() || null;
  if (outboundCaller) {
    try {
      outboundCaller = normalizeE164(outboundCaller);
    } catch {
      outboundCaller = null;
    }
  }

  return {
    enabled: enabled && destinations.length > 0 && routes.length > 0,
    detectVoicemailOnTransfer: wizard.detectVoicemailOnTransfer === true,
    defaultRingingTimeoutSeconds: defaultTimeout,
    defaultFallback: fallback,
    routing,
    destinations,
    routes,
    telephony: {
      outboundSipTrunkId: getStoredLiveKitOutboundTrunkId(),
      outboundCallerIdE164: outboundCaller,
    },
  };
}
