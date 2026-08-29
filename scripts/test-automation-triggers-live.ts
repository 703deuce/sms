/**
 * Live SMS smoke for automation triggers — sends REAL texts via Telnyx.
 * Only sends to OUTBOUND_TEST_PHONE and VOICE_TRANSFER_FALLBACK_E164.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-automation-triggers-live.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getPrisma } from "../src/lib/db";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";
import { fireContactAddedAutomations } from "../src/lib/automate/contact-added-triggers";
import { processDripCampaignStep } from "../src/lib/drip-campaigns/engine";
import { sendQuickSms } from "../src/lib/sms/send-quick";

const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const PHONE_A = normalizeE164(process.env.OUTBOUND_TEST_PHONE || "");
const PHONE_B = normalizeE164(process.env.VOICE_TRANSFER_FALLBACK_E164 || "");
const APPROVED = new Set([PHONE_A, PHONE_B].filter(Boolean));

const failures: string[] = [];
function ok(label: string, detail?: string) {
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label: string, detail?: string) {
  failures.push(detail ? `${label}: ${detail}` : label);
  console.log(`✗ ${label}${detail ? `: ${detail}` : ""}`);
}

function assertApproved(to: string) {
  const n = normalizeE164(to);
  if (!APPROVED.has(n)) throw new Error(`Refusing to send to ${n}; not an approved test phone`);
  return n;
}

async function processDueDripJobs(workspaceId: string) {
  const prisma = getPrisma();
  const jobs = await prisma.jobQueue.findMany({
    where: {
      jobType: "drip_campaign_step",
      status: { in: ["pending", "deferred"] },
    },
    orderBy: { runAfter: "asc" },
    take: 50,
  });

  let processed = 0;
  for (const job of jobs) {
    const payload = job.payload as { enrollmentId?: string; stepIndex?: number };
    if (!payload.enrollmentId) continue;
    const enrollment = await prisma.dripCampaignEnrollment.findUnique({
      where: { id: payload.enrollmentId },
      select: { workspaceId: true },
    });
    if (enrollment?.workspaceId !== workspaceId) continue;

    await processDripCampaignStep({
      enrollmentId: payload.enrollmentId,
      stepIndex: Number(payload.stepIndex ?? 0),
    });
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: { status: "completed", completedAt: new Date() },
    });
    processed += 1;
  }
  return processed;
}

async function main() {
  if (!PHONE_A || !PHONE_B || PHONE_A === PHONE_B) {
    throw new Error("Set OUTBOUND_TEST_PHONE and VOICE_TRANSFER_FALLBACK_E164 to two distinct numbers");
  }

  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({ where: { id: WORKSPACE_ID } });
  if (!workspace) throw new Error(`Workspace not found: ${WORKSPACE_ID}`);

  const reg = await prisma.messagingRegistration.findUnique({
    where: { workspaceId: WORKSPACE_ID },
  });
  if (!reg || reg.messagingProvider === "mock") {
    throw new Error("Workspace does not have live messaging configured");
  }

  const fromNumber = await prisma.phoneNumber.findFirst({
    where: { workspaceId: WORKSPACE_ID, status: "Active", provider: "telnyx" },
    select: { e164: true },
  });
  const fromE164 = fromNumber?.e164 || reg.phoneE164 || "";
  if (!fromE164) throw new Error("No Telnyx sending number for workspace");

  console.log(`workspace=${WORKSPACE_ID} (${workspace.name})`);
  console.log(`from=${fromE164}`);
  console.log(`to=${PHONE_A}, ${PHONE_B}`);

  const marker = `auto-live-${Date.now().toString(36)}`;
  const since = new Date();

  for (const phone of [PHONE_A, PHONE_B]) {
    const to = assertApproved(phone);
    const contact = await prisma.contact.findFirst({
      where: { workspaceId: WORKSPACE_ID, phone: to },
    });
    if (!contact) {
      fail(`contact exists in ${WORKSPACE_ID}`, to);
      continue;
    }
    ok(`contact found`, `${contact.firstName || ""} ${contact.id}`);

    // Direct live ping so you know Telnyx delivery works
    const pingBody = `Transovo automation live test ${marker}. Reply STOP to opt out.`;
    try {
      await sendQuickSms({
        workspaceId: WORKSPACE_ID,
        to,
        body: pingBody,
        from: fromE164,
        idempotencyKey: `live-ping:${marker}:${to}`,
      });
      ok(`direct SMS sent`, to);
    } catch (err) {
      fail(`direct SMS sent`, `${to}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Fire contact_added automations (drip + auto-reply if configured)
    const result = await fireContactAddedAutomations(WORKSPACE_ID, contact.id, {
      fromE164,
      consentSource: "manual",
    });
    if (result.dripEnrolled && result.dripEnrolled > 0) {
      ok(`contact_added drip enrolled`, to);
    } else if (result.autoReply?.sent) {
      ok(`contact_added auto-reply sent`, to);
    } else {
      fail(
        `contact_added automation fired`,
        `${to}: ${result.reason || result.autoReply?.skippedReason || "no_match"}`,
      );
    }
  }

  const dripProcessed = await processDueDripJobs(WORKSPACE_ID);
  ok(`drip step jobs processed`, String(dripProcessed));

  const messages = await prisma.message.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      to: { in: [...APPROVED] },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    select: { to: true, status: true, body: true, providerMessageId: true },
  });

  console.log("\nRecent outbound messages:");
  for (const m of messages) {
    console.log(`  ${m.to} [${m.status}] ${(m.body || "").slice(0, 60)}...`);
  }

  const delivered = messages.filter((m) =>
    ["sent", "delivered", "queued", "sending"].includes(m.status || ""),
  );
  if (delivered.length >= 2) ok("at least 2 live messages recorded");
  else fail("live message rows", `count=${delivered.length}`);

  console.log(`\n${failures.length === 0 ? "Live automation SMS smoke passed" : `${failures.length} failed`}`);
  if (failures.length) {
    console.log(failures.join("\n"));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
