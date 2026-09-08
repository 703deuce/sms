/**
 * Shared bootstrap for Appointments + MCTB browser certification workspace.
 * Used by seed script and POST /api/cert/appointments-mctb/bootstrap on preview.
 */
import { getPrisma } from "@/lib/db";
import { upsertAppointmentType } from "@/lib/appointments/booking-platform";
import { saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { grantProductEntitlement } from "@/lib/products/entitlements";
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { saveNotetakerConfig } from "@/lib/meeting-assistant/settings";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";

import {
  CERT_APPOINTMENT_TYPE_NAME,
  CERT_BROWSER_EMAIL,
  CERT_BUSINESS_LINE,
  CERT_FORWARD_E164,
  CERT_TYPE_PREFIX,
  CERT_WORKSPACE_SLUG,
} from "./appointments-mctb-browser-cert-constants";

export {
  CERT_APPOINTMENT_TYPE_NAME,
  CERT_BROWSER_EMAIL,
  CERT_BUSINESS_LINE,
  CERT_FORWARD_E164,
  CERT_TYPE_PREFIX,
  CERT_WORKSPACE_SLUG,
} from "./appointments-mctb-browser-cert-constants";

export type CertBootstrapResult = {
  workspaceId: string;
  appointmentTypeName: string;
  publicBookingSlug: string;
};

export async function bootstrapAppointmentsMctbBrowserCertWorkspace(
  workspaceId: string,
): Promise<CertBootstrapResult> {
  const prisma = getPrisma();

  await grantProductEntitlement(workspaceId, "voice", "trial");
  await grantProductEntitlement(workspaceId, "sms", "trial");
  await grantProductEntitlement(workspaceId, "numbers", "trial");
  await grantWorkspaceProductFeature(workspaceId, "mctb", "active");
  await grantWorkspaceProductFeature(workspaceId, "visual_voicemail", "active");
  await grantWorkspaceProductFeature(workspaceId, "ai_notetaker", "active");

  await saveNotetakerConfig(workspaceId, { enabled: true, autoJoin: true });

  const staffId = `cert-staff-${workspaceId.slice(0, 8)}`;
  const locationId = `cert-location-${workspaceId.slice(0, 8)}`;

  await saveAppointmentPlatformConfig(workspaceId, {
    bookingEnabled: true,
    timezone: "America/New_York",
    minimumBookingNoticeMinutes: 0,
    maximumBookingDaysAhead: 30,
    weeklyHours: {
      monday: [{ open: "09:00", close: "17:00" }],
      tuesday: [{ open: "09:00", close: "17:00" }],
      wednesday: [{ open: "09:00", close: "17:00" }],
      thursday: [{ open: "09:00", close: "17:00" }],
      friday: [{ open: "09:00", close: "17:00" }],
      saturday: [{ open: "09:00", close: "17:00" }],
      sunday: [{ open: "09:00", close: "17:00" }],
    },
    staff: [
      {
        id: staffId,
        name: "Cert Staff",
        active: true,
        customerSelectable: true,
        timezone: "America/New_York",
      },
    ],
    locations: [
      {
        id: locationId,
        name: "Cert Office",
        active: true,
      },
    ],
  });

  const existingType = await prisma.voiceService.findFirst({
    where: { workspaceId, name: CERT_APPOINTMENT_TYPE_NAME },
  });

  await upsertAppointmentType(workspaceId, {
    id: existingType?.id,
    name: CERT_APPOINTMENT_TYPE_NAME,
    durationMinutes: 30,
    config: {
      enabled: true,
      visibility: "public",
      managed: true,
      staffAssignment: "any_eligible",
      staffIds: [staffId],
      locationIds: [locationId],
      minimumBookingNoticeMinutes: 0,
      maximumBookingDaysAhead: 30,
    },
  });

  let phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: CERT_FORWARD_E164 },
  });
  if (!phone) {
    phone = await prisma.phoneNumber.create({
      data: {
        workspaceId,
        e164: CERT_FORWARD_E164,
        type: "TollFree",
        provider: "telnyx",
        status: "Active",
        friendlyName: "MCTB Cert Ingress",
        settingsJson: { mctbSipIngress: true, mctbRole: "customer_mctb" },
      },
    });
  }

  await prisma.missedCallTextConfig.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      enabled: true,
      phoneNumberId: phone.id,
      smsPhoneNumberId: phone.id,
      messageTemplate: "Sorry we missed your call — reply here when you have a moment.",
      delaySeconds: 30,
      timezone: "America/New_York",
    },
    update: {
      enabled: true,
      phoneNumberId: phone.id,
      smsPhoneNumberId: phone.id,
    },
  });

  await saveMissedCallTextBack(workspaceId, {
    phoneNumberId: phone.id,
    firstMessage: "Sorry we missed your call — reply here when you have a moment.",
    initialDelaySeconds: 30,
    consentMode: "press_1",
    activate: false,
  });

  const wsRow = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true, slug: true },
  });
  const customCfg =
    wsRow?.customFieldsConfig && typeof wsRow.customFieldsConfig === "object"
      ? (wsRow.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    customCfg.mctb && typeof customCfg.mctb === "object"
      ? (customCfg.mctb as Record<string, unknown>)
      : {};

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      customFieldsConfig: {
        ...customCfg,
        mctb: {
          ...mctb,
          businessLineE164: CERT_BUSINESS_LINE,
          consentMode: "press_1",
        },
      },
    },
  });

  const traceId = `cert-trace-${workspaceId.slice(0, 8)}`;
  const idempotencyKey = `cert-missed-call-${workspaceId}`;
  await prisma.missedCallEvent.upsert({
    where: { idempotencyKey },
    create: {
      workspaceId,
      callerE164: "+15555550177",
      businessE164: CERT_BUSINESS_LINE,
      phoneNumberId: phone.id,
      reason: "no_answer",
      disposition: "no_answer",
      eligible: true,
      status: "SMS_SENT",
      traceId,
      idempotencyKey,
      detectedAt: new Date(),
    },
    update: {
      callerE164: "+15555550177",
      businessE164: CERT_BUSINESS_LINE,
      status: "SMS_SENT",
      detectedAt: new Date(),
    },
  });

  return {
    workspaceId,
    appointmentTypeName: CERT_APPOINTMENT_TYPE_NAME,
    publicBookingSlug: wsRow?.slug || CERT_WORKSPACE_SLUG,
  };
}
