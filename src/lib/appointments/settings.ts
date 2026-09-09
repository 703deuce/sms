import "server-only";

import { randomBytes } from "crypto";
import { getPrisma } from "@/lib/db";
import {
  DEFAULT_PLATFORM_CONFIG,
  type AppointmentPlatformConfig,
  type AppointmentTimelineEvent,
} from "@/lib/appointments/types";

export const APPOINTMENTS_SOLUTION_TYPE = "appointments-platform";

export function publicToken(): string {
  return randomBytes(24).toString("hex");
}

export async function loadAppointmentPlatformConfig(
  workspaceId: string,
): Promise<AppointmentPlatformConfig> {
  const prisma = getPrisma();
  const row = await prisma.solutionSetup.findFirst({
    where: { workspaceId, solutionType: APPOINTMENTS_SOLUTION_TYPE },
    orderBy: { updatedAt: "desc" },
  });
  const stored = (row?.configJson || {}) as Partial<AppointmentPlatformConfig>;
  return {
    ...DEFAULT_PLATFORM_CONFIG,
    ...stored,
    reminders: {
      ...DEFAULT_PLATFORM_CONFIG.reminders,
      ...(stored.reminders || {}),
      confirmation: {
        ...DEFAULT_PLATFORM_CONFIG.reminders.confirmation,
        ...(stored.reminders?.confirmation || {}),
      },
      reminder24h: {
        ...DEFAULT_PLATFORM_CONFIG.reminders.reminder24h,
        ...(stored.reminders?.reminder24h || {}),
      },
      reminder2h: {
        ...DEFAULT_PLATFORM_CONFIG.reminders.reminder2h,
        ...(stored.reminders?.reminder2h || {}),
      },
    },
    voiceReminders: stored.voiceReminders
      ? ({
          ...(DEFAULT_PLATFORM_CONFIG.voiceReminders || {}),
          ...(stored.voiceReminders as AppointmentPlatformConfig["voiceReminders"]),
        } as AppointmentPlatformConfig["voiceReminders"])
      : undefined,
  };
}

export async function saveAppointmentPlatformConfig(
  workspaceId: string,
  patch: Partial<AppointmentPlatformConfig>,
): Promise<AppointmentPlatformConfig> {
  const prisma = getPrisma();
  const current = await loadAppointmentPlatformConfig(workspaceId);
  const next: AppointmentPlatformConfig = {
    ...current,
    ...patch,
    reminders: {
      ...current.reminders,
      ...(patch.reminders || {}),
    },
    voiceReminders: patch.voiceReminders ?? current.voiceReminders,
    schedulingLimits: patch.schedulingLimits
      ? { ...(current.schedulingLimits || {}), ...patch.schedulingLimits }
      : current.schedulingLimits,
    bookingLimits: patch.bookingLimits
      ? { ...(current.bookingLimits || {}), ...patch.bookingLimits }
      : current.bookingLimits,
    dateOverrides: patch.dateOverrides ?? current.dateOverrides,
    locations: patch.locations ?? current.locations,
  };

  const existing = await prisma.solutionSetup.findFirst({
    where: { workspaceId, solutionType: APPOINTMENTS_SOLUTION_TYPE },
  });

  if (existing) {
    await prisma.solutionSetup.update({
      where: { id: existing.id },
      data: { configJson: next as object, status: "ACTIVE", name: "Appointments" },
    });
  } else {
    await prisma.solutionSetup.create({
      data: {
        workspaceId,
        solutionType: APPOINTMENTS_SOLUTION_TYPE,
        name: "Appointments",
        status: "ACTIVE",
        configJson: next as object,
        externalKey: `appointments:${workspaceId}`,
      },
    });
  }

  return next;
}

export async function resolveWorkspaceBySlug(slug: string) {
  const prisma = getPrisma();
  return prisma.workspace.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      displayName: true,
      logoUrl: true,
    },
  });
}

export function appendTimeline(
  metadata: Record<string, unknown> | null | undefined,
  event: Omit<AppointmentTimelineEvent, "at"> & { at?: string },
): Record<string, unknown> {
  const base = { ...(metadata || {}) };
  const timeline = Array.isArray(base.timeline)
    ? ([...(base.timeline as AppointmentTimelineEvent[])] as AppointmentTimelineEvent[])
    : [];
  timeline.push({
    at: event.at || new Date().toISOString(),
    type: event.type,
    label: event.label,
    detail: event.detail,
  });
  base.timeline = timeline.slice(-50);
  return base;
}

export function publicBookingUrl(workspaceSlug: string, serviceId?: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  const path = serviceId
    ? `/book/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(serviceId)}`
    : `/book/${encodeURIComponent(workspaceSlug)}`;
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

export function publicActionUrl(kind: "confirm" | "cancel" | "reschedule", token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  const path = `/appointments/${kind}/${encodeURIComponent(token)}`;
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

/** Canonical manage-appointment URL from persisted metadata or legacy action links. */
export function resolveManageLinkFromMetadata(
  meta: { manageAppointmentUrl?: unknown; rescheduleUrl?: unknown },
  rescheduleToken?: string | null,
): string {
  if (typeof meta.manageAppointmentUrl === "string" && meta.manageAppointmentUrl.trim()) {
    return meta.manageAppointmentUrl;
  }
  if (typeof meta.rescheduleUrl === "string" && meta.rescheduleUrl.trim()) {
    return meta.rescheduleUrl;
  }
  if (rescheduleToken) return publicActionUrl("reschedule", rescheduleToken);
  return "";
}
