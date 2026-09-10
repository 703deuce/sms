import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listAppointmentTypes, type ListedAppointmentType } from "@/lib/appointments/booking-platform";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { getRoutingAnalytics, listRoutingSubmissions } from "@/lib/appointments/routing-forms";
import { listRoutingFormPresets } from "@/lib/appointments/routing-forms-presets";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const formId = searchParams.get("formId");

    const [platform, types, analytics, presets] = await Promise.all([
      loadAppointmentPlatformConfig(auth.workspaceId),
      listAppointmentTypes(auth.workspaceId, { includeSecret: true, includeUnlisted: true }),
      getRoutingAnalytics(auth.workspaceId),
      Promise.resolve(listRoutingFormPresets()),
    ]);

    const submissions = formId
      ? await listRoutingSubmissions(auth.workspaceId, formId)
      : [];

    return NextResponse.json({
      data: {
        bookingTypes: types
          .filter((t: ListedAppointmentType) => t.active)
          .map((t: ListedAppointmentType) => ({
            id: t.id,
            name: t.name,
            kind: t.config.bookingTypeKind || "SERVICE",
          })),
        staff: (platform.staff || [])
          .filter((s) => s.active !== false)
          .map((s) => ({ id: s.id, name: s.name })),
        analytics,
        submissions,
        presets,
        legacyRoutingRules: (platform as { routingRules?: unknown[] }).routingRules || [],
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
