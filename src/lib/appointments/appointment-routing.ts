import type { AppointmentPlatformConfig, RoutingRule } from "@/lib/appointments/types";
import { resolveRoutingDestination } from "@/lib/appointments/routing-resolution";

export type AppointmentRoutingDestination = RoutingRule["destination"];

/**
 * Canonical routing resolution for public booking and admin previews.
 * Legacy workspace `routingRules[]` remain authoritative until migrated to routing forms.
 */
export function resolveAppointmentRouting(
  config: Pick<AppointmentPlatformConfig, "routingRules">,
  bookingAnswers: Record<string, string>,
): AppointmentRoutingDestination | null {
  return resolveRoutingDestination(config.routingRules, bookingAnswers);
}

export function hasLegacyRoutingRules(
  rules: RoutingRule[] | undefined,
): boolean {
  return Array.isArray(rules) && rules.length > 0;
}
