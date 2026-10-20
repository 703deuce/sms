import type { VoiceV3AgentConfig, VoiceV3ServiceConfig } from "./agent-config";
import type { VoiceV3CallContext } from "../state/call-context";

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Authoritative bookable service for FIND/BOOK — wizard primary until caller selects another enabled type.
 */
export function resolveBookingServiceForRuntime(
  config: VoiceV3AgentConfig,
  ctx: VoiceV3CallContext,
): VoiceV3ServiceConfig {
  const services = config.services?.length ? config.services : [config.service];

  const explicitId =
    ctx.intake.values.booking_service_id?.value?.trim() ||
    ctx.intake.values.appointment_type_id?.value?.trim();
  if (explicitId) {
    const byId = services.find((s) => s.id === explicitId);
    if (byId) return byId;
  }

  const reason =
    ctx.intake.values.service_reason?.value?.trim() ||
    ctx.intake.values.service?.value?.trim();
  if (reason) {
    const n = normalizeName(reason);
    const exact = services.find((s) => normalizeName(s.name) === n);
    if (exact) return exact;
    const partial = services.find(
      (s) => normalizeName(s.name).includes(n) || n.includes(normalizeName(s.name)),
    );
    if (partial) return partial;
  }

  const primary = services.find((s) => s.id === config.scheduling?.primaryServiceId);
  if (primary) return primary;

  return config.service;
}
