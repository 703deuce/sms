/**
 * Production: create Microsoft-linked appointment + send reminder SMS (C/R/X).
 * Run in production container:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-prod-microsoft-smoke-setup.ts
 */
import { getPrisma } from "../src/lib/db";
import { maybeSendImmediateConfirmationForAppointment } from "../src/lib/appointments/reminder-delivery";
import { resolveAppointmentOutboundSmsRoute } from "../src/lib/appointments/sms-sender";
import { resolveAiReschedulerConfig, isAiReschedulerSmsEnabled } from "../src/lib/appointment-reminders/ai-rescheduler/types";
import { loadAppointmentPlatformConfig } from "../src/lib/appointments/settings";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const EMAIL = (process.env.EMAIL || "whywriteit@gmail.com").toLowerCase();
const PHONE_RAW = process.env.PHONE || "+15714776175";

async function main() {
  const phone = normalizeE164(PHONE_RAW);
  const prisma = getPrisma();

  const user = await prisma.user.findFirst({
    where: { email: { equals: EMAIL, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`User not found: ${EMAIL}`);

  const member = await prisma.membership.findFirst({
    where: { userId: user.id, workspaceId: WORKSPACE_ID },
    select: { workspaceId: true },
  });
  if (!member) {
    const any = await prisma.membership.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!any) throw new Error("No workspace membership");
    console.warn("Using workspace", any.workspaceId, "instead of", WORKSPACE_ID);
  }
  const workspaceId = member?.workspaceId || WORKSPACE_ID;

  const msConn = await prisma.voiceCalendarConnection.findFirst({
    where: {
      workspaceId,
      provider: "microsoft",
      status: { in: ["connected", "needs_reauth"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true, provider: true },
  });
  if (!msConn) {
    const all = await prisma.voiceCalendarConnection.findMany({
      where: { workspaceId },
      select: { id: true, provider: true, status: true, name: true },
    });
    console.error("No Microsoft calendar connection. Connections:", all);
    process.exit(1);
  }
  console.log("microsoft_connection", msConn);

  const { loadAppointmentRemindersActivation } = await import(
    "../src/lib/appointment-reminders/activation"
  );
  const activation = await loadAppointmentRemindersActivation(workspaceId);
  console.log("ar_activation", activation);

  const platformConfig = await loadAppointmentPlatformConfig(workspaceId);
  const arConfig = resolveAiReschedulerConfig(platformConfig);
  console.log("ai_rescheduler", arConfig);
  if (arConfig.mode !== "ai") {
    console.warn(
      "WARNING: aiRescheduler.mode is not 'ai' — reply R will not run the reschedule agent until mode is ai in Appointment Reminders settings.",
    );
  }

  const route = await resolveAppointmentOutboundSmsRoute(workspaceId);
  if (!route) {
    console.error(
      "No platform SMS route — reminders would fall back to workspace business line. Fix MCTB platform sender before live test.",
    );
    process.exit(1);
  }
  console.log("platform_sms_route", { fromE164: route.fromE164, sendWorkspaceId: route.sendWorkspaceId });
  if (!isAiReschedulerSmsEnabled(arConfig)) {
    console.error("AI rescheduler SMS copy (C/R/X) is disabled in platform config.");
    process.exit(1);
  }

  let contact = await prisma.contact.findFirst({
    where: { workspaceId, phone },
    select: { id: true },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId,
        phone,
        email: user.email,
        firstName: "Live",
        lastName: "AR test",
      },
      select: { id: true },
    });
  }

  const startsAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
  startsAt.setMinutes(0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
  const timezone = "America/New_York";

  const appt = await prisma.voiceAppointment.create({
    data: {
      workspaceId,
      contactId: contact.id,
      serviceName: "Microsoft AR live test",
      startsAt,
      endsAt,
      timezone,
      status: "scheduled",
      inviteePhone: phone,
      metadata: {
        source: "admin",
        inviteePhone: phone,
        inviteeEmail: user.email,
        inviteeName: "Live AR test",
        provider: "microsoft",
        connectionId: msConn.id,
        smsConsent: true,
        smsConsentAt: new Date().toISOString(),
      },
    },
    select: { id: true, startsAt: true },
  });

  console.log("appointment_created", {
    id: appt.id,
    startsAt: appt.startsAt.toISOString(),
    workspaceId,
    phone,
  });

  const sendResult = await maybeSendImmediateConfirmationForAppointment(workspaceId, appt.id);
  console.log("immediate_confirmation", sendResult);

  if (!sendResult.sent) {
    console.error(
      "Did not send production confirmation reminder. Do not use the UI/API test send — it is not the live AR path. Fix skip reason above (activation, SMS consent, confirmation step, allowance, etc.).",
    );
    process.exit(1);
  }

  console.log("\nReply R to the platform reminder SMS to start reschedule (Microsoft calendar).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
