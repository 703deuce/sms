/**
 * Production debug: last inbound/outbound SMS for AR live test phone.
 * WORKSPACE_ID=... PHONE=+1... npx tsx scripts/ar-prod-inbound-debug.ts
 */
import { getPrisma } from "../src/lib/db";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";
import { parseConversationState } from "../src/lib/appointments/ai-scheduling/conversation-state";
import { parseReminderContexts } from "../src/lib/appointment-reminders/ai-rescheduler/reminder-reply-context-store";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "cmut0q7nc6o3w1n0o3o1i0w41";
const PHONE = normalizeE164(process.env.PHONE || "+15714776175");
const APPT_ID = process.env.APPT_ID || "cmuytkp2a2j3w5g2q6u4v2317";

async function main() {
  const prisma = getPrisma();

  const contact = await prisma.contact.findFirst({
    where: { workspaceId: WORKSPACE_ID, phone: PHONE },
    select: { id: true, phone: true, customFields: true },
  });
  console.log("contact", contact?.id, contact?.phone);
  if (contact?.customFields) {
    console.log("conversation_state", parseConversationState(contact.customFields));
    console.log("reminder_contexts", parseReminderContexts(contact.customFields));
  }

  const appt = await prisma.voiceAppointment.findFirst({
    where: { id: APPT_ID, workspaceId: WORKSPACE_ID },
    select: { id: true, metadata: true, status: true, startsAt: true },
  });
  console.log(
    "appointment",
    appt?.id,
    appt?.status,
    appt?.startsAt,
    appt?.metadata ? JSON.stringify(appt.metadata).slice(0, 500) : null,
  );

  const messages = await prisma.message.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      OR: [{ to: PHONE }, { from: PHONE }],
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      direction: true,
      from: true,
      to: true,
      body: true,
      status: true,
      createdAt: true,
      providerId: true,
    },
  });
  console.log("\nrecent_messages");
  for (const m of messages) {
    console.log({
      at: m.createdAt.toISOString(),
      dir: m.direction,
      from: m.from,
      to: m.to,
      status: m.status,
      body: m.body?.slice(0, 120),
    });
  }

  const conv = await prisma.conversation.findFirst({
    where: { workspaceId: WORKSPACE_ID, contactId: contact?.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, updatedAt: true },
  });
  if (conv) {
    const convMsgs = await prisma.conversationMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { direction: true, body: true, createdAt: true },
    });
    console.log("\nconversation", conv.id, convMsgs);
  }

  const webhooks = await prisma.providerWebhookEvent.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { eventType: true, createdAt: true, payload: true },
  });
  console.log("\nrecent_webhooks", webhooks.length);
  for (const w of webhooks) {
    const p = w.payload as { from?: string; to?: string; text?: string; body?: string };
    const body = p?.text || p?.body || "";
    if (!String(body).toUpperCase().includes("R") && !String(p?.from || "").includes("571")) continue;
    console.log({
      at: w.createdAt.toISOString(),
      type: w.eventType,
      from: p?.from,
      to: p?.to,
      body: String(body).slice(0, 80),
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
