import type { AppointmentPlatformConfig, AppointmentTypeConfig } from "@/lib/appointments/types";
import type { TeamBookingRequirement, TeamBookingServiceConfig } from "./types";

export function isTeamBookingEnabled(cfg: AppointmentTypeConfig): boolean {
  if (cfg.teamBooking?.enabled && cfg.teamBooking.requirements?.length) return true;
  if (cfg.staffAssignment === "collective" && (cfg.collectiveStaffIds?.length || 0) > 1) {
    return true;
  }
  return false;
}

/** Legacy collective → synthetic requirements (all required specific staff). */
export function requirementsFromService(
  cfg: AppointmentTypeConfig,
  platform: AppointmentPlatformConfig,
): TeamBookingRequirement[] {
  if (cfg.teamBooking?.requirements?.length) {
    return cfg.teamBooking.requirements;
  }
  if (cfg.staffAssignment === "collective" && cfg.collectiveStaffIds?.length) {
    return cfg.collectiveStaffIds.map((staffId, index) => ({
      id: `legacy-${index}`,
      label: index === 0 ? "Primary" : `Team member ${index + 1}`,
      kind: index === 0 ? "primary" : "required",
      required: true,
      assignment: { mode: "specific_staff", staffId },
    }));
  }
  if (cfg.teamBooking?.templateId) {
    const tpl = platform.teamBookingTemplates?.find((t) => t.id === cfg.teamBooking!.templateId);
    if (tpl?.requirements?.length) return tpl.requirements;
  }
  return [];
}

export function resolveTeamServiceConfig(
  cfg: AppointmentTypeConfig,
  platform: AppointmentPlatformConfig,
): TeamBookingServiceConfig {
  const base = platform.teamBookingDefaults || {};
  const custom = cfg.teamBooking || {};
  const requirements = requirementsFromService(cfg, platform);
  return {
    ...base,
    ...custom,
    enabled: isTeamBookingEnabled(cfg),
    requirements,
  };
}

export function requiredRequirementCount(requirements: TeamBookingRequirement[]): number {
  return requirements.filter((r) => r.required && r.kind !== "optional").length;
}
