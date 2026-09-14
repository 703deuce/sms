#!/usr/bin/env npx tsx
/**
 * Why didn't MCTB text send? — last events, suppression, traces, send replay hint.
 *
 *   CUSTOMER_PHONE=5714776175 WORKSPACE_ID=ws_1 \
 *   npx tsx scripts/mctb-live-diagnose-last-missed-call.ts
 */
import { getPrisma } from "@/lib/db";
import { evaluateMissedCallTextEligibility } from "@/lib/agents/missed-call-text-back/eligibility";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";

const WS = process.env.WORKSPACE_ID || "ws_1";
const raw = process.env.CUSTOMER_PHONE || process.argv[2] || "5714776175";
const digits = raw.replace(/\D/g, "");
const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const events = await prisma.missedCallEvent.findMany({
    where: {
      workspaceId: WS,
      OR: [{ callerE164: e164 }, { createdAt: { gte: since } }],
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const callerEvents = events.filter((e) => e.callerE164 === e164);

  const suppression = await prisma.suppression.findMany({
    where: {
      workspaceId: WS,
      OR: [{ phone: e164 }, { suppressionKey: { contains: digits.slice(-10) } }],
    },
    take: 10,
  });

  const contact = await prisma.contact.findFirst({
    where: { workspaceId: WS, phone: e164 },
    select: { id: true, status: true, phone: true },
  });

  const config = await loadMissedCallTextConfig(WS);

  console.log("=== MCTB SEND DIAGNOSE ===");
  console.log({ workspaceId: WS, caller: e164, mctbEnabled: config.enabled, delay: config.delay_seconds });

  console.log("\n--- Contact ---");
  console.log(contact);

  console.log("\n--- Suppression rows ---");
  console.log(suppression.length ? suppression : "(none)");

  console.log("\n--- Last missedCallEvents for this caller (24h) ---");
  for (const e of callerEvents.length ? callerEvents : events.slice(0, 5)) {
    const traces = await prisma.missedCallTextTrace.findMany({
      where: { missedCallEventId: e.id },
      orderBy: { createdAt: "asc" },
      take: 30,
    });
    const jobs = await prisma.jobQueue.findMany({
      where: { idempotencyKey: { contains: e.id } },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    let eligibility: unknown = null;
    try {
      eligibility = await evaluateMissedCallTextEligibility({
        workspaceId: WS,
        callerE164: e.callerE164,
        businessE164: e.businessE164,
        phoneNumberId: e.phoneNumberId,
        metadata: (e.metadata as Record<string, unknown>) || {},
      });
    } catch (err) {
      eligibility = { error: String(err) };
    }

    console.log("\nEVENT", e.id);
    console.log({
      createdAt: e.createdAt,
      caller: e.callerE164,
      business: e.businessE164,
      status: e.status,
      eligible: e.eligible,
      suppressionReason: e.suppressionReason,
      smsSentAt: e.smsSentAt,
      scheduledSmsAt: e.scheduledSmsAt,
      metadata: e.metadata,
    });
    console.log("eligibilityNow:", eligibility);
    console.log(
      "traceKinds:",
      traces.map((t) => ({
        at: t.createdAt,
        kind: t.kind,
        detail: (t as { detail?: unknown; detailJson?: unknown }).detail ?? t.detailJson,
      })),
    );
    console.log("jobs:", jobs.map((j) => ({ status: j.status, type: j.jobType, key: j.idempotencyKey })));
  }

  const consent = await prisma.smartRoutingSmsConsentEvent.findMany({
    where: { workspaceId: WS, callerNumber: e164 },
    orderBy: { consentedAt: "desc" },
    take: 3,
  });
  console.log("\n--- Press-1 consent events (caller) ---");
  console.log(consent);

  console.log("\n--- Hint ---");
  console.log(
    "If status=SUPPRESSED, see suppressionReason. To replay send (if eligible):",
    `npx tsx scripts/diag-mctb-stuck-send.ts <eventId> --send`,
  );
}

main();
