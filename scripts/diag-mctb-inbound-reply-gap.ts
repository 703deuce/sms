#!/usr/bin/env npx tsx
/**
 * Find MCTB threads where opener/customer inbound had no LR outbound reply.
 * WORKSPACE_ID=ws_1 HOURS=6 npx tsx scripts/diag-mctb-inbound-reply-gap.ts
 */
import Module from "node:module";
const o = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = (r, p, m) =>
  r === "server-only" ? {} : o(r, p, m);

const WS = process.env.WORKSPACE_ID || "ws_1";
const hours = Number(process.env.HOURS || 6);

async function main() {
  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();
  const since = new Date(Date.now() - hours * 3600_000);

  const events = await prisma.missedCallEvent.findMany({
    where: { workspaceId: WS, smsSentAt: { gte: since } },
    orderBy: { smsSentAt: "desc" },
    take: 15,
    select: {
      id: true,
      callerE164: true,
      smsSentAt: true,
      createdAt: true,
      status: true,
    },
  });

  console.log("=== Missed-call openers (recent) ===\n");
  for (const e of events) {
    const contact = await prisma.contact.findFirst({
      where: { workspaceId: WS, phone: e.callerE164 },
      select: { id: true },
    });
    const conv = contact
      ? await prisma.conversation.findFirst({
          where: { workspaceId: WS, contactId: contact.id, productSource: "MCTB" },
          orderBy: { updatedAt: "desc" },
          select: { id: true, updatedAt: true },
        })
      : null;

    const msgs = conv
      ? await prisma.conversationMessage.findMany({
          where: { conversationId: conv.id, createdAt: { gte: since } },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true, direction: true, body: true },
        })
      : [];

    const inboundAfterOpener = msgs.filter(
      (m) =>
        m.direction.toLowerCase().includes("in") &&
        e.smsSentAt &&
        m.createdAt > e.smsSentAt,
    );
    const outboundAfterInbound = inboundAfterOpener.length
      ? msgs.filter(
          (m) =>
            m.direction.toLowerCase().includes("out") &&
            inboundAfterOpener[0] &&
            m.createdAt > inboundAfterOpener[0].createdAt,
        )
      : [];

    const gap =
      inboundAfterOpener.length > 0 && outboundAfterInbound.length === 0
        ? "NO_REPLY_AFTER_INBOUND"
        : inboundAfterOpener.length > 0
          ? "OK"
          : "NO_CUSTOMER_REPLY_YET";

    console.log({
      caller: e.callerE164,
      eventId: e.id,
      openerAt: e.smsSentAt?.toISOString(),
      gap,
      convId: conv?.id,
      msgTail: msgs.slice(-4).map((m) => ({
        at: m.createdAt.toISOString(),
        dir: m.direction,
        body: m.body.slice(0, 80),
      })),
    });
  }

  const recentSms = await prisma.message.findMany({
    where: { workspaceId: WS, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      createdAt: true,
      direction: true,
      status: true,
      to: true,
      from: true,
      idempotencyKey: true,
      failureCategory: true,
      providerErrorCode: true,
      body: true,
    },
  });
  console.log("\n=== message table (recent) ===");
  for (const m of recentSms) {
    const key = m.idempotencyKey || "";
    if (!key.includes("mctb") && !m.body?.includes("missed your call")) continue;
    console.log(
      m.createdAt.toISOString(),
      m.status,
      key.slice(0, 60),
      (m.body || "").slice(0, 60),
      m.failureCategory || "",
      m.providerErrorCode || "",
    );
  }

  const { loadLeadRecoveryConfig } = await import("../src/lib/mctb/lead-recovery/config");
  const { loadMissedCallTextConfig } = await import("../src/lib/agents/missed-call-text-back/config");
  const lr = await loadLeadRecoveryConfig(WS);
  const mctb = await loadMissedCallTextConfig(WS);
  console.log("\n=== Config ===");
  console.log({
    leadRecoveryEnabled: lr.enabled,
    policyHealth: lr.policyHealth,
    mctbEnabled: mctb.enabled,
    conversationEnabled: mctb.conversationEnabled,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
