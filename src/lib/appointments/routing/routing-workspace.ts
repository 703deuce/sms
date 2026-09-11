import "server-only";

import { listAppointmentTypes } from "@/lib/appointments";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata, BookingTypeKind } from "@/lib/appointments/types";
import {
  customerSelectionLabel,
  decodeRoutingPolicy,
  normalizeStaffRouting,
  routingMethodLabel,
} from "@/lib/appointments/routing/routing-model";

export type RoutingWorkspacePayload = {
  staffRouting: ReturnType<typeof normalizeStaffRouting>;
  staff: Array<{ id: string; name: string; active: boolean; locationIds: string[] }>;
  locations: Array<{ id: string; name: string }>;
  schedulingGroups: Array<{
    id: string;
    name: string;
    memberCount: number;
    serviceCount: number;
    locationCount: number;
    methodLabel: string;
    active: boolean;
  }>;
  services: Array<{
    id: string;
    name: string;
    kind: BookingTypeKind;
    customerSelection: string;
    methodLabel: string;
    eligibleStaff: number;
    locationCount: number;
    status: "ready" | "needs_setup" | "na";
    usesDefault: boolean;
    staffAssignment: string;
    config: {
      staffIds: string[];
      staffPriorityOrder: string[];
      allowAnyAvailable?: boolean;
      useWorkspaceRoutingDefault?: boolean;
    };
  }>;
  overview: {
    defaultMethod: string;
    defaultCustomerSelection: string;
    routableServices: number;
    autoRouted: number;
    customerChooses: number;
    noEligibleStaff: number;
    overrideCount: number;
    distribution: Array<{ staffId: string; staffName: string; bookings: number }>;
    issues: Array<{ id: string; message: string; href?: string }>;
  };
  activity: Array<{
    id: string;
    at: string;
    bookingLabel: string;
    serviceName: string;
    staffName: string;
    method: string;
    source: string;
    result: string;
    appointmentId: string;
    detail?: string;
  }>;
  readiness: {
    availabilityEngine: "ready" | "attention";
    staffAssignments: "ready" | "attention";
    calendarConflicts: "ready" | "attention";
    servicesNeedingAttention: number;
  };
};

function isServiceLike(kind: BookingTypeKind | undefined): boolean {
  return kind === "SERVICE" || kind === "MEETING" || !kind;
}

export async function buildRoutingWorkspace(workspaceId: string): Promise<RoutingWorkspacePayload> {
  const [platform, types, appointments] = await Promise.all([
    loadAppointmentPlatformConfig(workspaceId),
    listAppointmentTypes(workspaceId, { includeSecret: true, includeUnlisted: true }),
    getPrisma().voiceAppointment.findMany({
      where: {
        workspaceId,
        status: { notIn: ["canceled", "cancelled"] },
        startsAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
      select: {
        id: true,
        serviceName: true,
        startsAt: true,
        firstName: true,
        lastName: true,
        metadata: true,
        updatedAt: true,
      },
    }),
  ]);

  const staffRouting = normalizeStaffRouting(platform.staffRouting);
  const staff = (platform.staff || [])
    .filter((s) => s.active !== false)
    .map((s) => ({
      id: s.id,
      name: s.name,
      active: s.active !== false,
      locationIds: s.locationIds || [],
    }));

  const locations = (platform.locations || []).map((l) => ({ id: l.id, name: l.name }));
  const groups = platform.schedulingGroups || [];

  const services = types
    .filter((t) => isServiceLike(t.config?.bookingTypeKind))
    .map((t) => {
      const cfg = t.config || {};
      const decoded = decodeRoutingPolicy(cfg, staffRouting);
      const pool = cfg.staffIds?.length || 0;
      let status: "ready" | "needs_setup" | "na" = "ready";
      if (!decoded.isRoutable) status = decoded.routingNaReason ? "na" : "needs_setup";
      if (pool === 0 && isServiceLike(cfg.bookingTypeKind)) status = "needs_setup";

      return {
        id: t.id,
        name: t.name,
        kind: (cfg.bookingTypeKind || "SERVICE") as BookingTypeKind,
        customerSelection: customerSelectionLabel(decoded.customerSelection),
        methodLabel:
          decoded.customerSelection === "customer_must_choose" ||
          decoded.customerSelection === "customer_may_choose_or_any"
            ? "—"
            : routingMethodLabel(decoded.autoMethod),
        eligibleStaff: pool,
        locationCount: cfg.locationIds?.length || locations.length,
        status,
        usesDefault: decoded.usesWorkspaceDefault,
        staffAssignment: cfg.staffAssignment || "any_eligible",
        config: {
          staffIds: cfg.staffIds || [],
          staffPriorityOrder: cfg.staffPriorityOrder || [],
          allowAnyAvailable: cfg.allowAnyAvailable,
          useWorkspaceRoutingDefault: cfg.useWorkspaceRoutingDefault,
        },
      };
    });

  let autoRouted = 0;
  let customerChooses = 0;
  let noEligibleStaff = 0;
  let overrideCount = 0;
  for (const s of services) {
    if (s.status === "needs_setup") noEligibleStaff += 1;
    if (s.customerSelection.includes("Customer")) customerChooses += 1;
    else if (s.methodLabel !== "—") autoRouted += 1;
    if (!s.usesDefault) overrideCount += 1;
  }

  const distMap = new Map<string, { staffId: string; staffName: string; bookings: number }>();
  for (const row of appointments) {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const staffId = meta.staffId as string | undefined;
    if (!staffId) continue;
    const staffName = staff.find((s) => s.id === staffId)?.name || "Staff";
    const cur = distMap.get(staffId) || { staffId, staffName, bookings: 0 };
    cur.bookings += 1;
    distMap.set(staffId, cur);
  }
  const distribution = [...distMap.values()].sort((a, b) => b.bookings - a.bookings);

  const issues: RoutingWorkspacePayload["overview"]["issues"] = [];
  for (const s of services.filter((x) => x.status === "needs_setup")) {
    issues.push({
      id: s.id,
      message: `${s.name} has no eligible staff for routing`,
      href: `/appointments/services?type=${s.id}`,
    });
  }
  const priorityIncomplete = services.filter(
    (s) => s.methodLabel === "Priority" && s.config.staffPriorityOrder.length === 0,
  );
  for (const s of priorityIncomplete) {
    issues.push({
      id: `prio-${s.id}`,
      message: `${s.name} uses Priority but has no priority order`,
    });
  }

  const activity: RoutingWorkspacePayload["activity"] = [];
  for (const row of appointments.slice(0, 80)) {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    if (!meta.staffId) continue;
    const staffName = staff.find((s) => s.id === meta.staffId)?.name || "Staff";
    const customer = [row.firstName, row.lastName].filter(Boolean).join(" ") || "Customer";
    activity.push({
      id: row.id,
      at: row.updatedAt.toISOString(),
      bookingLabel: customer,
      serviceName: row.serviceName || "Service",
      staffName,
      method: routingMethodLabel(
        (meta.routingMethod as string) || services.find((s) => s.name === row.serviceName)?.methodLabel || "Assigned",
      ),
      source: meta.source || meta.bookingSource || "booking",
      result: "Assigned",
      appointmentId: row.id,
    });
  }
  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const staffWithNoHours = staff.filter((s) => !platform.staff?.find((m) => m.id === s.id)?.weeklyHours);
  if (staffWithNoHours.length) {
    issues.push({
      id: "staff-hours",
      message: `${staffWithNoHours.length} staff member(s) rely on business hours only`,
      href: "/appointments/availability",
    });
  }

  return {
    staffRouting,
    staff,
    locations,
    schedulingGroups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g.memberStaffIds?.length || 0,
      serviceCount: g.memberTypeIds?.length || 0,
      locationCount: 0,
      methodLabel: g.roundRobinEnabled ? "Round Robin" : "Pool",
      active: g.active !== false,
    })),
    services,
    overview: {
      defaultMethod: routingMethodLabel(staffRouting.defaultAutoMethod || "round_robin"),
      defaultCustomerSelection: customerSelectionLabel(
        staffRouting.defaultCustomerSelection || "auto_assign_hidden",
      ),
      routableServices: services.filter((s) => s.status !== "na").length,
      autoRouted,
      customerChooses,
      noEligibleStaff,
      overrideCount,
      distribution,
      issues: issues.slice(0, 8),
    },
    activity: activity.slice(0, 50),
    readiness: {
      availabilityEngine: "ready",
      staffAssignments: noEligibleStaff ? "attention" : "ready",
      calendarConflicts: platform.externalCalendarBlocking?.enabled ? "ready" : "ready",
      servicesNeedingAttention: issues.length,
    },
  };
}
