import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";
import {
  listAppointmentTypes,
  loadAppointmentPlatformConfig,
  publicBookingUrl,
  saveAppointmentPlatformConfig,
} from "@/lib/appointments";
import type { AppointmentPlatformConfig } from "@/lib/appointments/types";
import type { SchedulerThemeConfig } from "@/lib/appointments/service-booking/types";
import { getPrisma } from "@/lib/db";

const BOOKING_PATCH_KEYS: (keyof AppointmentPlatformConfig)[] = [
  "bookingEnabled",
  "publicBookingProfile",
  "businessDisplayName",
  "timezone",
  "businessPhone",
  "businessAddress",
  "consentText",
  "termsUrl",
  "privacyUrl",
  "termsText",
  "termsVersion",
  "bookingProtection",
];

function pickBookingPatch(body: Partial<AppointmentPlatformConfig>): Partial<AppointmentPlatformConfig> {
  const patch: Partial<AppointmentPlatformConfig> = {};
  for (const key of BOOKING_PATCH_KEYS) {
    if (key in body && body[key] !== undefined) {
      (patch as Record<string, unknown>)[key] = body[key];
    }
  }
  return patch;
}

function isSimpleBookingType(config?: { bookingTypeKind?: string } | null): boolean {
  const kind = resolveBookingTypeKind(config ?? undefined);
  return kind === "MEETING" || kind === "SERVICE";
}

export async function GET() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;

    const [settings, types, workspace] = await Promise.all([
      loadAppointmentPlatformConfig(auth.workspaceId),
      listAppointmentTypes(auth.workspaceId, { includeSecret: true, includeUnlisted: true }),
      getPrisma().workspace.findUnique({
        where: { id: auth.workspaceId },
        select: { slug: true, name: true, displayName: true },
      }),
    ]);

    const simpleTypes = types.filter((row) => isSimpleBookingType(row.config));

    const schedulerTheme = (settings as { schedulerTheme?: SchedulerThemeConfig }).schedulerTheme || {};

    return NextResponse.json({
      data: {
        settings,
        schedulerTheme,
        types: simpleTypes,
        workspace: workspace
          ? {
              slug: workspace.slug,
              name: workspace.displayName || workspace.name,
              bookingUrl: workspace.slug ? publicBookingUrl(workspace.slug) : null,
            }
          : null,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Partial<AppointmentPlatformConfig> & {
      schedulerTheme?: SchedulerThemeConfig;
    };
    const patch = pickBookingPatch(body);
    if (body.schedulerTheme && typeof body.schedulerTheme === "object") {
      const current = await loadAppointmentPlatformConfig(auth.workspaceId);
      const prev = (current as { schedulerTheme?: SchedulerThemeConfig }).schedulerTheme || {};
      (patch as { schedulerTheme?: SchedulerThemeConfig }).schedulerTheme = {
        ...prev,
        ...body.schedulerTheme,
      };
    }
    if (patch.bookingEnabled === true && patch.publicBookingProfile === undefined) {
      patch.publicBookingProfile = "simple";
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No supported booking fields in request" }, { status: 400 });
    }
    const data = await saveAppointmentPlatformConfig(auth.workspaceId, patch);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
