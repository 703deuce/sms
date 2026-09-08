/**
 * Seed stable workspace for Appointments + MCTB browser certification.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/seed-appointments-mctb-browser-cert.ts
 */
import { hash } from "bcryptjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "../src/lib/db";
import { upsertAppointmentType } from "../src/lib/appointments/booking-platform";
import { saveAppointmentPlatformConfig } from "../src/lib/appointments/settings";
import { grantProductEntitlement } from "../src/lib/products/entitlements";
import { grantWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";
import { saveMissedCallTextBack } from "../src/lib/solutions/missed-call-text-back/save";

export const CERT_BROWSER_EMAIL = "appt-mctb-browser@transovo.test";
export const CERT_WORKSPACE_SLUG = "appt-mctb-browser-cert";
const CERT_PASSWORD = "ApptMctbBrowserCert_v1!";
const CERT_BUSINESS_LINE = "+15555550188";
const CERT_FORWARD_E164 = "+18885550199";
const CERT_APPOINTMENT_TYPE_NAME = "Browser Cert Consultation";

async function main() {
  const prisma = getPrisma();
  const passwordHash = await hash(CERT_PASSWORD, 10);

  let user = await prisma.user.findUnique({ where: { email: CERT_BROWSER_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: CERT_BROWSER_EMAIL,
        name: "Appt MCTB Browser Cert",
        passwordHash,
        phone: "+15555550200",
        phoneVerifiedAt: new Date(),
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, name: "Appt MCTB Browser Cert" },
    });
  }

  let workspace = await prisma.workspace.findUnique({ where: { slug: CERT_WORKSPACE_SLUG } });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Appt MCTB Browser Cert",
        slug: CERT_WORKSPACE_SLUG,
        type: "BUSINESS",
        ownerUserId: user.id,
        billingPlan: "trial",
        creditBalanceCents: 500_000,
        memberships: { create: { userId: user.id, role: "OWNER" } },
        messagingRegistration: { create: {} },
        workspaceLimits: {
          create: {
            limits: { dailyCap: 500, maxNumbers: 5, trialDays: 14, requireCard: false },
          },
        },
      },
    });
  } else {
    const membership = await prisma.membership.findFirst({
      where: { userId: user.id, workspaceId: workspace.id },
    });
    if (!membership) {
      await prisma.membership.create({
        data: { userId: user.id, workspaceId: workspace.id, role: "OWNER" },
      });
    }
  }

  await grantProductEntitlement(workspace.id, "voice", "trial");
  await grantProductEntitlement(workspace.id, "sms", "trial");
  await grantProductEntitlement(workspace.id, "numbers", "trial");
  await grantWorkspaceProductFeature(workspace.id, "mctb", "active");
  await grantWorkspaceProductFeature(workspace.id, "visual_voicemail", "active");
  await grantWorkspaceProductFeature(workspace.id, "ai_notetaker", "active");

  const staffId = `cert-staff-${workspace.id.slice(0, 8)}`;
  const locationId = `cert-location-${workspace.id.slice(0, 8)}`;

  await saveAppointmentPlatformConfig(workspace.id, {
    bookingEnabled: true,
    timezone: "America/New_York",
    minimumBookingNoticeMinutes: 60,
    maximumBookingDaysAhead: 30,
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
    where: { workspaceId: workspace.id, name: CERT_APPOINTMENT_TYPE_NAME },
  });

  await upsertAppointmentType(workspace.id, {
    id: existingType?.id,
    name: CERT_APPOINTMENT_TYPE_NAME,
    durationMinutes: 30,
    config: {
      enabled: true,
      visibility: "public",
      staffAssignment: "any_eligible",
      staffIds: [staffId],
      locationIds: [locationId],
      minimumBookingNoticeMinutes: 60,
      maximumBookingDaysAhead: 30,
    },
  });

  let phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId: workspace.id, e164: CERT_FORWARD_E164 },
  });
  if (!phone) {
    phone = await prisma.phoneNumber.create({
      data: {
        workspaceId: workspace.id,
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
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
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

  await saveMissedCallTextBack(workspace.id, {
    phoneNumberId: phone.id,
    firstMessage: "Sorry we missed your call — reply here when you have a moment.",
    initialDelaySeconds: 30,
    consentMode: "press_1",
    activate: false,
  });

  const wsRow = await prisma.workspace.findUnique({
    where: { id: workspace.id },
    select: { customFieldsConfig: true },
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
    where: { id: workspace.id },
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

  const traceId = `cert-trace-${workspace.id.slice(0, 8)}`;
  const idempotencyKey = `cert-missed-call-${workspace.id}`;
  await prisma.missedCallEvent.upsert({
    where: { idempotencyKey },
    create: {
      workspaceId: workspace.id,
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

  mkdirSync(join(process.cwd(), "artifacts/browser-cert"), { recursive: true });
  const creds = {
    email: CERT_BROWSER_EMAIL,
    password: CERT_PASSWORD,
    workspaceId: workspace.id,
    workspaceSlug: CERT_WORKSPACE_SLUG,
    appointmentTypeName: CERT_APPOINTMENT_TYPE_NAME,
    publicBookingSlug: CERT_WORKSPACE_SLUG,
  };
  writeFileSync(join(process.cwd(), "artifacts/browser-cert/credentials.json"), JSON.stringify(creds, null, 2));
  console.log("Seeded browser cert workspace:", CERT_BROWSER_EMAIL, workspace.id);
  console.log("  appointment type:", CERT_APPOINTMENT_TYPE_NAME);
  console.log("  public booking slug:", CERT_WORKSPACE_SLUG);
  console.log("  missed call fixture: yes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
