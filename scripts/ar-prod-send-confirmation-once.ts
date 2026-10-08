/**
 * Send immediate confirmation for one appointment (ops).
 * WORKSPACE_ID=ws_1 APPT_ID=... NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-prod-send-confirmation-once.ts
 */
import { maybeSendImmediateConfirmationForAppointment } from "../src/lib/appointments/reminder-delivery";
import { getPrisma } from "../src/lib/db";
import { sendArReminderSmsWithSession } from "../src/lib/appointment-reminders/messaging/outbound-reminder";
import { seedRescheduleConversationOnReminderSend } from "../src/lib/appointment-reminders/ai-rescheduler/inbound-replies";
import { loadAppointmentPlatformConfig } from "../src/lib/appointments/settings";
import { reminderTimelineType } from "../src/lib/appointments/reminder-state";
import { AR_REPLY_INSTRUCTIONS_SUFFIX } from "../src/lib/appointment-reminders/ai-rescheduler/types";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";

const workspaceId = process.env.WORKSPACE_ID || "ws_1";
const appointmentId = process.env.APPT_ID || "";
const FORCE = process.env.FORCE === "1";

async function main() {
  if (!appointmentId) {
    console.error("Set APPT_ID");
    process.exit(1);
  }
  const r = await maybeSendImmediateConfirmationForAppointment(workspaceId, appointmentId);
  console.log("maybeSendImmediateConfirmation", r);
  if (!r.sent && FORCE) {
    const prisma = getPrisma();
    const row = await prisma.voiceAppointment.findFirst({
      where: { id: appointmentId, workspaceId },
    });
    if (!row?.contactId) {
      console.error("missing_contact_id");
      process.exit(1);
    }
    const contact = await prisma.contact.findFirst({
      where: { id: row.contactId, workspaceId },
      select: { phone: true },
    });
    const metaPhone = (row.metadata as { inviteePhone?: string })?.inviteePhone;
    const phone = contact?.phone || metaPhone;
    if (!phone) {
      console.error("missing_phone");
      process.exit(1);
    }
    const config = await loadAppointmentPlatformConfig(workspaceId);
    const timelineType = reminderTimelineType("confirmation");
    const when = row.startsAt.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: row.timezone || config.timezone,
    });
    const body = `Hi ${row.metadata && (row.metadata as { inviteeName?: string }).inviteeName?.split(/\s+/)[0] || "there"}, your ${row.serviceName || "appointment"} with our team is confirmed for ${when}.${AR_REPLY_INSTRUCTIONS_SUFFIX}`;
    const sent = await sendArReminderSmsWithSession({
      workspaceId,
      appointmentId: row.id,
      contactId: row.contactId,
      phone: normalizeE164(phone),
      body,
      timelineType,
    });
    console.log("force_sendArReminderSmsWithSession", sent);
    if (sent.sent) {
      await seedRescheduleConversationOnReminderSend({
        workspaceId,
        contactId: row.contactId,
        appointmentId: row.id,
        timelineType,
      });
    } else {
      process.exit(1);
    }
  }
  const row = await getPrisma().voiceAppointment.findFirst({
    where: { id: appointmentId },
    select: { metadata: true },
  });
  const meta = row?.metadata as { reminderSentKeys?: string[]; timeline?: Array<{ type: string; detail?: string }> };
  console.log("metadata_reminder", meta?.reminderSentKeys);
  console.log("metadata_timeline_tail", meta?.timeline?.slice(-3));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
