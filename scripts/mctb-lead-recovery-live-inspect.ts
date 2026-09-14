#!/usr/bin/env npx tsx
/**
 * Post-turn inspector for live AI Lead Recovery SMS tests.
 * Read-only: conversation thread, LR state, AI booking session, domain events.
 *
 *   WORKSPACE_ID=... CUSTOMER_PHONE=+15551234567 npx tsx scripts/mctb-lead-recovery-live-inspect.ts
 *   WORKSPACE_ID=... CONVERSATION_ID=... npx tsx scripts/mctb-lead-recovery-live-inspect.ts
 */
import Module from "node:module";

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim();
const CONVERSATION_ID = process.env.CONVERSATION_ID?.trim();
const CUSTOMER_PHONE = process.env.CUSTOMER_PHONE?.trim();

function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return p.startsWith("+") ? p : `+${digits}`;
}

function smsSegments(body: string): number {
  const len = body.length;
  if (len <= 160) return 1;
  if (len <= 306) return 2;
  return Math.ceil(len / 153);
}

async function main() {
  if (!WORKSPACE_ID) {
    console.error("Set WORKSPACE_ID");
    process.exit(1);
  }
  if (!CONVERSATION_ID && !CUSTOMER_PHONE) {
    console.error("Set CONVERSATION_ID or CUSTOMER_PHONE");
    process.exit(1);
  }

  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();

  let conversationId = CONVERSATION_ID;
  let contactPhone: string | null = CUSTOMER_PHONE ? normalizePhone(CUSTOMER_PHONE) : null;

  if (!conversationId && contactPhone) {
    const contact = await prisma.contact.findFirst({
      where: { workspaceId: WORKSPACE_ID, phone: contactPhone },
      select: { id: true, phone: true, firstName: true, lastName: true, email: true },
    });
    if (!contact) {
      console.error(`No contact for phone ${contactPhone}`);
      process.exit(1);
    }
    const conv = await prisma.conversation.findFirst({
      where: {
        workspaceId: WORKSPACE_ID,
        contactId: contact.id,
        productSource: "MCTB",
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (!conv) {
      console.error("No MCTB conversation for contact");
      process.exit(1);
    }
    conversationId = conv.id;
    console.log("Contact:", contact);
  }

  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId!, workspaceId: WORKSPACE_ID },
    include: {
      contact: { select: { phone: true, firstName: true, lastName: true, email: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 80 },
    },
  });
  if (!conv) {
    console.error("Conversation not found");
    process.exit(1);
  }
  contactPhone = conv.contact.phone;

  const automation = await prisma.mctbConversationAutomationState.findUnique({
    where: { conversationId: conv.id },
  });

  const captured = (automation?.capturedFieldsJson || {}) as Record<string, unknown>;
  const leadRecovery = captured.leadRecovery as Record<string, unknown> | undefined;

  const bookingSession = await prisma.mctbAiBookingSession.findUnique({
    where: { conversationId: conv.id },
  });

  const activities = await prisma.mctbConversationBookingActivity.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const bookingConfirmed = activities.filter((a) => a.kind === "BOOKING_CONFIRMED");
  const createHints = activities.filter((a) =>
    /BOOKING|create|confirm/i.test(a.kind),
  );

  console.log("\n=== LIVE MCTB INSPECT ===\n");
  console.log("workspaceId:", WORKSPACE_ID);
  console.log("conversationId:", conv.id);
  console.log("contact:", conv.contact);
  console.log("automation.state:", automation?.state ?? "(none)");
  console.log("automation.appointmentId:", automation?.appointmentId ?? "(none)");
  console.log("missedCallEventId:", automation?.missedCallEventId ?? conv.missedCallEventId ?? "(none)");

  console.log("\n--- SMS thread (last 80) ---");
  for (const m of conv.messages) {
    const dir = m.direction.toLowerCase().includes("out") ? "business" : "customer";
    const seg = smsSegments(m.body);
    console.log(`[${m.createdAt.toISOString()}] ${dir} (${seg} seg): ${m.body.slice(0, 500)}`);
  }

  console.log("\n--- Lead Recovery state (capturedFieldsJson.leadRecovery) ---");
  console.log(JSON.stringify(leadRecovery ?? null, null, 2));

  console.log("\n--- AI booking session ---");
  if (!bookingSession) {
    console.log("(no mctb_ai_booking_sessions row)");
  } else {
    console.log({
      stage: bookingSession.stage,
      provider: bookingSession.provider,
      providerBookingId: bookingSession.providerBookingId,
      idempotencyKey: bookingSession.idempotencyKey,
      offeredSlotsJson: bookingSession.offeredSlotsJson,
      selectedSlotJson: bookingSession.selectedSlotJson,
      updatedAt: bookingSession.updatedAt,
    });
  }

  console.log("\n--- Booking activity timeline ---");
  for (const a of activities) {
    console.log(`${a.createdAt.toISOString()} ${a.kind}`, JSON.stringify(a.payloadJson));
  }

  console.log("\n--- Checklist hints (automated — confirm in provider UI) ---");
  const inbound = conv.messages.filter((m) => !m.direction.toLowerCase().includes("out"));
  const outbound = conv.messages.filter((m) => m.direction.toLowerCase().includes("out"));
  const lastOut = outbound.at(-1);

  const hints: Record<string, string> = {
    "Inbound customer SMS received": inbound.length > 0 ? "LIKELY PASS" : "FAIL",
    "BOOKING_CONFIRMED persisted":
      bookingConfirmed.length === 1 ? "LIKELY PASS" : bookingConfirmed.length > 1 ? "FAIL (multiple)" : "CHECK",
    "Exactly one booking created":
      bookingSession?.providerBookingId
        ? "CHECK provider — one id: " + bookingSession.providerBookingId
        : "CHECK — no providerBookingId on session yet",
    "Provider booking actually created": bookingSession?.providerBookingId ? "LIKELY PASS" : "PENDING",
    "Final SMS segment count": lastOut ? String(smsSegments(lastOut.body)) : "n/a",
  };
  for (const [k, v] of Object.entries(hints)) {
    console.log(`  ${k}: ${v}`);
  }

  console.log(
    "\nManual: calendar date/time, DeepSeek intent, no duplicate questions, no invented slots, truthful final SMS.\n",
  );
  console.log("Full checklist: docs/MCTB-AI-LEAD-RECOVERY-LIVE-MANUAL-TEST-RUNBOOK.md\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
