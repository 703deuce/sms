import type { AgentConfig } from "@/lib/agent";
import { isConversationalIvrEditor } from "@/lib/receptionist/runtime-profile";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { getStoredLiveKitOutboundTrunkId } from "@/lib/telephony/provisioning/livekit/outbound-trunk";
import { mapWizardTransferFallback } from "@/lib/server/voice-v3/transfer/map-fallback";
import { buildConversationalRouteAiDescription } from "@/lib/receptionist/conversational-route-helpers";
import { transferTriggerPhrasesFromEditor } from "@/lib/server/receptionist/transfer-triggers-from-editor";
import type { VoiceV3TransferFallback } from "@/lib/server/voice-v3/transfer/types";
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

function conversationalFallback(editor: AgentConfig): VoiceV3TransferFallback {
  const fb = editor.conversationalRouting?.whenTransferFails ?? "message";
  if (fb === "message") return "TAKE_MESSAGE";
  if (fb === "end") return "END_CALL";
  return mapWizardTransferFallback("return_to_ai");
}

function compileConversationalIvrTransferPolicy(
  editor: AgentConfig,
): VoiceV3TransferPolicyCompiled {
  const adv = editor.transferAdvanced;
  const defaultTimeout = Math.max(5, adv.ringSeconds ?? 30);
  const defaultWarm = editor.transferStyle === "warm";
  const mode: VoiceV3TransferMode = defaultWarm ? "WARM" : "DIRECT";
  const fallback = conversationalFallback(editor);

  const destinations: VoiceV3TransferDestinationCompiled[] = [];
  const routes: VoiceV3TransferRouteCompiled[] = [];

  const addDestination = (
    id: string,
    label: string,
    phoneE164: string,
    description?: string,
  ): string => {
    if (!phoneE164) return "";
    const existing = destinations.find((d) => d.id === id);
    if (existing) return existing.id;
    destinations.push({
      id,
      label,
      description,
      phoneE164,
      defaultMode: mode,
      ringingTimeoutSeconds: defaultTimeout,
      enabled: true,
    });
    return id;
  };

  for (const route of editor.conversationalRoutes ?? []) {
    if (!route.enabled) continue;
    if (route.destinationKind === "ring_group" && route.destinationRef?.trim()) {
      const groupId = route.destinationRef.trim();
      const destId = `ring_group_${groupId}`;
      if (!destinations.some((d) => d.id === destId)) {
        destinations.push({
          id: destId,
          label: route.destinationLabel?.trim() || route.name?.trim() || "Ring group",
          description: route.description?.trim() || route.intentDescription?.trim(),
          phoneE164: "",
          forwardingGroupId: groupId,
          defaultMode: mode,
          ringingTimeoutSeconds: defaultTimeout,
          enabled: true,
        });
      }
      routes.push({
        id: route.id,
        label: route.name?.trim() || "Ring group",
        description: buildConversationalRouteAiDescription({
          ...route,
          description: route.description ?? "",
        }),
        targets: [
          {
            destinationId: destId,
            mode,
            ringingTimeoutSeconds: defaultTimeout,
          },
        ],
        fallback,
      });
      continue;
    }
    let phone = route.destinationPhoneE164?.trim() ?? "";
    let destId = `route_dest_${route.id}`;
    const label = route.destinationLabel?.trim() || route.name?.trim() || "Route destination";

    if (!phone && route.destinationKind === "transfer_destination") {
      const legacy = editor.transfers.find((t) => t.id === route.destinationRef);
      if (legacy?.number?.trim()) {
        try {
          phone = normalizeE164(legacy.number.trim());
        } catch {
          phone = "";
        }
        destId = legacy.id;
      }
    }

    if (!phone) continue;

    try {
      phone = normalizeE164(phone);
    } catch {
      continue;
    }

    const resolvedDestId = addDestination(
      destId,
      label,
      phone,
      route.description?.trim() || route.intentDescription?.trim(),
    );
    if (!resolvedDestId) continue;

    const description = buildConversationalRouteAiDescription({
      ...route,
      description: route.description ?? "",
    });

    routes.push({
      id: route.id,
      label: route.name?.trim() || "Route",
      description,
      targets: [
        {
          destinationId: resolvedDestId,
          mode,
          ringingTimeoutSeconds: defaultTimeout,
        },
      ],
      fallback,
    });
  }

  const defaultRef = editor.conversationalRouting?.defaultDestinationRef?.trim();
  if (defaultRef && routes.length === 0) {
    const legacy = editor.transfers.find((t) => t.id === defaultRef);
    const phoneRaw = legacy?.number?.trim();
    if (phoneRaw) {
      try {
        const phone = normalizeE164(phoneRaw);
        const destId = addDestination(legacy!.id, legacy!.name || "Default", phone);
        routes.push({
          id: "default_transfer_route",
          label: "Default route",
          description: "When caller intent is unclear or they ask for a person.",
          targets: [{ destinationId: destId, mode, ringingTimeoutSeconds: defaultTimeout }],
          fallback,
        });
      } catch {
        // skip invalid default
      }
    }
  }

  const enabled =
    editor.capabilities.transfer === true && destinations.length > 0 && routes.length > 0;

  return {
    enabled,
    defaultRingingTimeoutSeconds: defaultTimeout,
    defaultFallback: fallback,
    routing: "single",
    destinations,
    routes,
    telephony: {
      outboundSipTrunkId: getStoredLiveKitOutboundTrunkId(),
      outboundCallerIdE164: null,
    },
  };
}

export function compileVoiceV3TransferPolicyFromEditor(editor: AgentConfig): VoiceV3TransferPolicyCompiled {
  if (isConversationalIvrEditor(editor)) {
    return compileConversationalIvrTransferPolicy(editor);
  }
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
