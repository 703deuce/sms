import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { recordWorkspaceExistingCustomerSmsConsent } from "@/lib/appointment-reminders/record-existing-sms-consent";
import { AR_EXISTING_CUSTOMER_SMS_CONSENT_ATTESTATION_TEXT } from "@/lib/appointment-reminders/workspace-existing-sms-consent";

export async function GET() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;
    const { loadAppointmentPlatformConfig } = await import("@/lib/appointments/settings");
    const { hasWorkspaceExistingCustomerSmsConsent, getAppointmentRemindersWorkspaceConfig } =
      await import("@/lib/appointment-reminders/workspace-existing-sms-consent");
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    return NextResponse.json({
      data: {
        attested: hasWorkspaceExistingCustomerSmsConsent(platform),
        record: getAppointmentRemindersWorkspaceConfig(platform).existingCustomerSmsConsent ?? null,
        attestationText: AR_EXISTING_CUSTOMER_SMS_CONSENT_ATTESTATION_TEXT,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { attested?: boolean };
    if (body.attested !== true) {
      return NextResponse.json(
        { error: "You must confirm existing customer SMS permission to continue." },
        { status: 400 },
      );
    }
    const data = await recordWorkspaceExistingCustomerSmsConsent({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      email: auth.session.email,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
