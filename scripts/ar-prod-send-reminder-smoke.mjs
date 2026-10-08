/**
 * Create appointment on ws_1 + send immediate reminder SMS with C/R/X.
 * Run inside production /app: node scripts/ar-prod-send-reminder-smoke.mjs
 */
import Module from "node:module";
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE = process.env.PHONE || "+15714776175";
const EMAIL = process.env.EMAIL || "whywriteit@gmail.com";

const { getPrisma } = await import("../src/lib/db.js").catch(() => import("../src/lib/db.ts"));
const prisma = getPrisma();

const user = await prisma.user.findFirst({
  where: { email: { equals: EMAIL, mode: "insensitive" } },
});
console.log("user", user?.email || "missing");

const conn = await prisma.voiceCalendarConnection.findFirst({
  where: { workspaceId: WORKSPACE_ID, provider: { in: ["google", "microsoft"] } },
  orderBy: { updatedAt: "desc" },
});
console.log("calendar", conn?.provider, conn?.id, conn?.status);

let contact = await prisma.contact.findFirst({
  where: { workspaceId: WORKSPACE_ID, phone: PHONE },
});
if (!contact) {
  contact = await prisma.contact.create({
    data: {
      workspaceId: WORKSPACE_ID,
      phone: PHONE,
      email: EMAIL,
      firstName: "Live",
      lastName: "AR",
    },
  });
}

const startsAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
startsAt.setUTCMinutes(0, 0, 0);
const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

const appt = await prisma.voiceAppointment.create({
  data: {
    workspaceId: WORKSPACE_ID,
    contactId: contact.id,
    serviceName: "Consultation",
    startsAt,
    endsAt,
    timezone: "America/New_York",
    status: "scheduled",
    inviteePhone: PHONE,
    metadata: {
      inviteePhone: PHONE,
      inviteeEmail: EMAIL,
      inviteeName: "Live AR test",
      smsConsent: true,
      smsConsentAt: new Date().toISOString(),
      provider: conn?.provider,
      connectionId: conn?.id,
      source: "admin",
    },
  },
});

console.log("created appointment", appt.id, startsAt.toISOString());

const { maybeSendImmediateConfirmationForAppointment } = await import(
  "../src/lib/appointments/reminder-delivery.ts"
);
const { resolveAppointmentOutboundSmsRoute } = await import("../src/lib/appointments/sms-sender.ts");
const route = await resolveAppointmentOutboundSmsRoute(WORKSPACE_ID, PHONE);
console.log("platform_sms_route", route?.fromE164 || "MISSING");

const sent = await maybeSendImmediateConfirmationForAppointment(WORKSPACE_ID, appt.id);
console.log("immediate_confirmation", sent);

if (!sent.sent) {
  console.error(
    "STOP: production confirmation did not send. Do not use test-reminder fallback — fix skip reason above.",
  );
  process.exitCode = 1;
}

await prisma.$disconnect();
