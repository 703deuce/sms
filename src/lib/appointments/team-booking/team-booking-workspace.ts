import "server-only";

import { listAppointmentTypes } from "@/lib/appointments";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import {
  isTeamBookingEnabled,
  requirementsFromService,
  requiredRequirementCount,
} from "./team-booking-model";

export async function buildTeamBookingWorkspace(workspaceId: string) {
  const [platform, types, appointments] = await Promise.all([
    loadAppointmentPlatformConfig(workspaceId),
    listAppointmentTypes(workspaceId, { includeSecret: true, includeUnlisted: true }),
    getPrisma().voiceAppointment.findMany({
      where: {
        workspaceId,
        startsAt: { gte: new Date() },
        status: { notIn: ["canceled", "cancelled"] },
      },
      orderBy: { startsAt: "asc" },
      take: 40,
      select: {
        id: true,
        serviceName: true,
        startsAt: true,
        firstName: true,
        lastName: true,
        status: true,
        metadata: true,
        location: true,
      },
    }),
  ]);

  const staff = (platform.staff || []).filter((s) => s.active !== false);
  const locations = (platform.locations || []).map((l) => ({ id: l.id, name: l.name }));
  const templates = platform.teamBookingTemplates || [];

  const services = types
    .filter((t) => {
      const kind = t.config?.bookingTypeKind || "SERVICE";
      return kind === "SERVICE" || kind === "MEETING";
    })
    .map((t) => {
      const cfg = t.config || {};
      const enabled = isTeamBookingEnabled(cfg);
      const reqs = requirementsFromService(cfg, platform);
      const required = requiredRequirementCount(reqs);
      return {
        id: t.id,
        name: t.name,
        kind: cfg.bookingTypeKind || "SERVICE",
        teamMode: enabled ? "team_required" : "single_staff",
        requiredStaff: enabled ? required : 1,
        teamRuleLabel: enabled
          ? reqs.map((r) => r.label).join(" + ") || "Collective hosts"
          : "—",
        locationCount: cfg.locationIds?.length || locations.length,
        status:
          enabled && required === 0
            ? "needs_setup"
            : enabled
              ? "ready"
              : "not_enabled",
        teamBooking: cfg.teamBooking,
        staffAssignment: cfg.staffAssignment,
        collectiveStaffIds: cfg.collectiveStaffIds || [],
      };
    });

  const teamServices = services.filter((s) => s.teamMode === "team_required");
  const needsSetup = teamServices.filter((s) => s.status === "needs_setup").length;

  const upcoming = appointments
    .filter((a) => {
      const meta = (a.metadata || {}) as AppointmentMetadata;
      return (meta.teamStaffIds?.length || 0) > 1;
    })
    .map((a) => {
      const meta = (a.metadata || {}) as AppointmentMetadata;
      const names = (meta.teamStaffIds || [])
        .map((id) => staff.find((s) => s.id === id)?.name || "Staff")
        .join(" + ");
      return {
        id: a.id,
        at: a.startsAt.toISOString(),
        serviceName: a.serviceName || "Service",
        customer: [a.firstName, a.lastName].filter(Boolean).join(" ") || "Customer",
        teamLabel: names || meta.staffId || "—",
        location: a.location || "—",
        status: a.status,
      };
    });

  const activity = appointments
    .map((a) => {
      const meta = (a.metadata || {}) as AppointmentMetadata;
      if (!meta.teamStaffIds?.length) return null;
      return {
        id: a.id,
        at: a.startsAt.toISOString(),
        bookingLabel: [a.firstName, a.lastName].filter(Boolean).join(" ") || "Customer",
        serviceName: a.serviceName || "Service",
        teamLabel: meta.teamStaffIds
          .map((id) => staff.find((s) => s.id === id)?.name || "Staff")
          .join(" + "),
        method: "Auto",
        source: meta.source || "booking",
        status: a.status,
        appointmentId: a.id,
      };
    })
    .filter(Boolean);

  return {
    defaults: platform.teamBookingDefaults || {},
    staff: staff.map((s) => ({ id: s.id, name: s.name })),
    locations,
    templates,
    schedulingGroups: (platform.schedulingGroups || []).map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g.memberStaffIds?.length || 0,
    })),
    services,
    overview: {
      teamServices: teamServices.length,
      activeRules: teamServices.length,
      staffParticipating: new Set(teamServices.flatMap((s) => s.collectiveStaffIds)).size,
      ready: teamServices.filter((s) => s.status === "ready").length,
      needsSetup,
      upcomingTeamBookings: upcoming.length,
      issues: teamServices
        .filter((s) => s.status === "needs_setup")
        .map((s) => ({ id: s.id, message: `${s.name} has incomplete team requirements` })),
    },
    upcoming,
    activity,
  };
}
