import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import {
  applyAppointmentRemindersPlatformTemplatePolicy,
  PLATFORM_AR_ALLOWED_MERGE_TAGS,
  usesPlatformAppointmentSmsSender,
} from "@/lib/appointment-reminders/platform-template-policy";
import {
  loadAppointmentPlatformConfig,
  publicBookingUrl,
  saveAppointmentPlatformConfig,
} from "@/lib/appointments";
import type { AppointmentPlatformConfig } from "@/lib/appointments/types";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const [data, workspace, platformSender] = await Promise.all([
      loadAppointmentPlatformConfig(auth.workspaceId),
      getPrisma().workspace.findUnique({
        where: { id: auth.workspaceId },
        select: { slug: true, name: true, displayName: true, logoUrl: true },
      }),
      usesPlatformAppointmentSmsSender(auth.workspaceId),
    ]);
    return NextResponse.json({
      data,
      workspace: workspace
        ? {
            slug: workspace.slug,
            name: workspace.displayName || workspace.name,
            logoUrl: workspace.logoUrl,
            bookingUrl: workspace.slug ? publicBookingUrl(workspace.slug) : null,
          }
        : null,
      messaging: {
        platformSender,
        templateEditingLocked: platformSender,
        allowedMergeTags: platformSender ? PLATFORM_AR_ALLOWED_MERGE_TAGS : null,
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
    const body = (await request.json()) as Partial<AppointmentPlatformConfig>;
    const policyPatch = await applyAppointmentRemindersPlatformTemplatePolicy(auth.workspaceId, body);
    const { validateReminderConfigForPlan, ArFeatureGateError } = await import(
      "@/lib/appointment-reminders/commercial/ar-feature-gates"
    );
    const merged = { ...(await loadAppointmentPlatformConfig(auth.workspaceId)), ...policyPatch };
    try {
      await validateReminderConfigForPlan(auth.workspaceId, merged);
    } catch (err) {
      if (err instanceof ArFeatureGateError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 403 });
      }
      throw err;
    }
    const data = await saveAppointmentPlatformConfig(auth.workspaceId, policyPatch);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
