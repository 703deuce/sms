/**
 * Compact authoritative business projection for Astra (Phase 10).
 * Supplements delegated conversation context — not a transcript rebuild.
 */

import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { evaluateVoiceV3Rules } from "../state/call-rules";

export type AstraBusinessContext = {
  caller_information: Record<string, string>;
  missing_required_information: string[];
  scheduling: {
    current_generation: number;
    current_offer_set_id: string | null;
    selected_slot_id: string | null;
  };
  existing_appointment: {
    provider_event_id: string | null;
    local_start: string | null;
  } | null;
  pending_operations: string[];
  confirmation_state: {
    cancellation_awaiting_confirmation: boolean;
  };
  business: {
    timezone: string;
    service_id: string;
    transfer_destinations: string[];
  };
};

export function buildAstraBusinessContext(
  ctx: VoiceV3CallContext,
  config: VoiceV3AgentConfig,
): AstraBusinessContext {
  const rules = evaluateVoiceV3Rules(ctx, config);
  const caller_information: Record<string, string> = {};
  for (const f of config.intakeFields) {
    const v = ctx.intake.values[f.key]?.value?.trim();
    if (v) caller_information[f.key] = v;
  }

  const verified = ctx.appointmentManagement.verifiedExisting;
  const destinations: string[] = [];
  const raw = process.env.VOICE_V3_TRANSFER_DESTINATIONS?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      destinations.push(...Object.keys(parsed));
    } catch {
      /* ignore */
    }
  } else if (process.env.VOICE_V3_TRANSFER_DESTINATION?.trim()) {
    destinations.push("default");
  }

  return {
    caller_information,
    missing_required_information: rules.missingRequiredFields,
    scheduling: {
      current_generation: ctx.scheduling.generation,
      current_offer_set_id: ctx.availability.activeOfferSet?.offerSetId ?? null,
      selected_slot_id: ctx.selection.selected?.slotId ?? null,
    },
    existing_appointment: verified
      ? {
          provider_event_id: verified.providerEventId,
          local_start: verified.localStart,
        }
      : null,
    pending_operations: Object.values(ctx.operations ?? {})
      .filter((op) => op.status === "PENDING" || op.status === "RUNNING")
      .map((op) => op.operationId),
    confirmation_state: {
      cancellation_awaiting_confirmation:
        ctx.appointmentManagement.cancellation.awaitingConfirmation ?? false,
    },
    business: {
      timezone: ctx.business.timezone,
      service_id: config.service.id,
      transfer_destinations: destinations,
    },
  };
}

export function formatAstraBusinessContextForThinking(
  projection: AstraBusinessContext,
): string {
  return `Authoritative business state (backend):\n${JSON.stringify(projection, null, 2)}`;
}
