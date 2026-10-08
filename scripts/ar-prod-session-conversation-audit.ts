/**
 * Audit AR reply session conversationId vs inbound conversation messages.
 * PHONE=+1... WORKSPACE_ID=... npx tsx scripts/ar-prod-session-conversation-audit.ts
 */
import { getPrisma } from "../src/lib/db";
import { normalizeMctbCallerE164 } from "../src/lib/mctb/messaging/caller-e164";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "cmut0q7nc6o3w1n0o3o1i0w41";
const PHONE = normalizeMctbCallerE164(process.env.PHONE || "+15714776175");

async function main() {
  const prisma = getPrisma();
  const sessions = await prisma.arSmsReplySession.findMany({
    where: { workspaceId: WORKSPACE_ID, consumerE164: PHONE },
    orderBy: { lastUsedAt: "desc" },
    take: 5,
    select: {
      id: true,
      appointmentId: true,
      conversationId: true,
      lifecycleState: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
  console.log("sessions", JSON.stringify(sessions, null, 2));

  for (const s of sessions) {
    if (!s.conversationId) {
      console.log("session", s.id, "has null conversationId");
      continue;
    }
    const convMsgs = await prisma.conversationMessage.findMany({
      where: { conversationId: s.conversationId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, direction: true, body: true, createdAt: true, providerMessageId: true },
    });
    console.log("\nmessages on session conversation", s.conversationId, convMsgs);

    const otherConv = await prisma.conversationMessage.findMany({
      where: {
        conversation: { workspaceId: WORKSPACE_ID, contact: { phone: PHONE } },
        NOT: { conversationId: s.conversationId },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        conversationId: true,
        direction: true,
        body: true,
        createdAt: true,
      },
    });
    if (otherConv.length) {
      console.log("OTHER conversation messages for same contact:", otherConv);
    }
  }

  const recentOutbound = await prisma.message.findMany({
    where: { workspaceId: WORKSPACE_ID, to: PHONE },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { createdAt: true, body: true },
  });
  console.log("\nrecent outbound to customer:");
  for (const m of recentOutbound) {
    console.log(m.createdAt.toISOString(), (m.body || "").slice(0, 120));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
