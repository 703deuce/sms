#!/usr/bin/env node
/**
 * Production cert: two handsets — review one-offs, review list campaign (drip), mass-text list.
 *
 * **Safety:** Does not send live SMS unless `CERT_ALLOW_LIVE_SEND=1` (or `--send`).
 * Use `--verify-only` to inspect recent sends without enqueueing anything new.
 *
 * Run on app container (has DATABASE_URL + provider keys):
 *   CERT_ALLOW_LIVE_SEND=1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/prod-two-phone-reviews-mass-cert.ts
 *
 * Env: WORKSPACE_ID (default ws_1), TRANSOVO_SMS_CERT_PHONES, CERT_SKIP_IF_SENT_WITHIN_MINUTES (default 120)
 */
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const PHONES = (
  process.env.TRANSOVO_SMS_CERT_PHONES?.trim() || "+15714776175,+17038166017"
)
  .split(/[,;\s]+/)
  .map((p) => normalizeE164(p.trim()))
  .filter(Boolean) as string[];

const argv = new Set(process.argv.slice(2));
const VERIFY_ONLY = argv.has("--verify-only");
const ALLOW_SEND =
  argv.has("--send") ||
  process.env.CERT_ALLOW_LIVE_SEND === "1" ||
  process.env.CERT_ALLOW_LIVE_SEND === "true";
const SKIP_IF_SENT_MINUTES = Number(
  process.env.CERT_SKIP_IF_SENT_WITHIN_MINUTES?.trim() || "120",
);

type Step = "review-one-off" | "review-list" | "mass-list";
const ALL_STEPS: Step[] = ["review-one-off", "review-list", "mass-list"];
function stepsToRun(): Step[] {
  const fromEnv = process.env.CERT_STEPS?.trim();
  if (fromEnv) {
    return fromEnv.split(/[,;\s]+/).filter((s): s is Step =>
      (ALL_STEPS as string[]).includes(s),
    );
  }
  if (argv.has("--mass-only")) return ["mass-list"];
  if (argv.has("--review-only")) return ["review-one-off", "review-list"];
  return ALL_STEPS;
}

async function recentOutboundCounts(prisma: Awaited<ReturnType<typeof import("../src/lib/db")["getPrisma"]>>) {
  const since = new Date(Date.now() - SKIP_IF_SENT_MINUTES * 60 * 1000);
  const rows = await prisma.message.findMany({
    where: { workspaceId: WORKSPACE_ID, to: { in: PHONES }, createdAt: { gte: since } },
    select: { to: true },
  });
  const byPhone: Record<string, number> = {};
  for (const r of rows) {
    byPhone[r.to] = (byPhone[r.to] ?? 0) + 1;
  }
  return { since, byPhone, total: rows.length };
}

async function main() {
  const steps = stepsToRun();
  console.log("workspace", WORKSPACE_ID, "phones", PHONES, {
    verifyOnly: VERIFY_ONLY,
    allowSend: ALLOW_SEND,
    steps,
    skipIfSentWithinMinutes: SKIP_IF_SENT_MINUTES,
  });

  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();

  const recent = await recentOutboundCounts(prisma);
  console.log("\n--- Recent outbound (Message table) ---", recent);

  if (VERIFY_ONLY) {
    const { createServiceClient } = await import("../src/lib/db/client");
    const sb = createServiceClient();
    const { data: reviewSends } = await sb
      .from("review_request_sends")
      .select("recipient_phone, status, created_at")
      .in("recipient_phone", PHONES)
      .order("created_at", { ascending: false })
      .limit(20);
    console.log("review_request_sends", reviewSends);
    return;
  }

  if (!ALLOW_SEND) {
    console.error(
      "\nRefusing to send: set CERT_ALLOW_LIVE_SEND=1 or pass --send. Use --verify-only to inspect only.",
    );
    process.exit(2);
  }

  const maxRecent = Math.max(0, ...PHONES.map((p) => recent.byPhone[p] ?? 0));
  if (maxRecent > 0 && !argv.has("--force")) {
    console.error(
      `\nRefusing to send: at least one cert phone already has ${maxRecent} Message row(s) in the last ${SKIP_IF_SENT_MINUTES} minutes. Pass --force to override.`,
    );
    process.exit(3);
  }

  process.env.REVIEW_CAMPAIGN_IMMEDIATE_SEND = "true";

  for (const phone of PHONES) {
    await prisma.contact.upsert({
      where: { workspaceId_phone: { workspaceId: WORKSPACE_ID, phone } },
      create: {
        workspaceId: WORKSPACE_ID,
        phone,
        firstName: "Cert",
        lastName: phone.slice(-4),
        status: "SUBSCRIBED",
      },
      update: { status: "SUBSCRIBED" },
    });
  }

  const contacts = await prisma.contact.findMany({
    where: { workspaceId: WORKSPACE_ID, phone: { in: PHONES } },
    select: { id: true, phone: true },
  });
  if (contacts.length < PHONES.length) {
    throw new Error(`Expected ${PHONES.length} contacts, got ${contacts.length}`);
  }

  const businessId = WORKSPACE_ID;
  const organizationId = WORKSPACE_ID;

  const { createServiceClient } = await import("../src/lib/db/client");
  const supabase = createServiceClient();
  const { data: existingLink } = await supabase
    .from("review_request_links")
    .select("id")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .maybeSingle();
  if (!existingLink) {
    const { createOrRefreshReviewLink } = await import("../src/lib/reputation/review-requests");
    const linkResult = await createOrRefreshReviewLink({
      businessId,
      organizationId,
      forceRefresh: false,
    });
    if (!linkResult.link) {
      const certUrl =
        process.env.REVIEW_CERT_GOOGLE_URL?.trim() ||
        "https://search.google.com/local/writereview?placeid=ChIJCERTPLACEHOLDER";
      const { error } = await supabase.from("review_request_links").insert({
        organization_id: organizationId,
        business_id: businessId,
        review_url: certUrl,
        short_url: `cert-${businessId}`,
        is_active: true,
      });
      if (error) throw new Error(`Failed to seed cert review link: ${error.message}`);
      console.log("seeded cert review link", certUrl);
    } else {
      console.log("review link ready", linkResult.link.id);
    }
  }

  let reviewCampaign: { campaign: { id: string } } | null = null;
  let mass: { id: string } | null = null;

  if (steps.includes("review-one-off")) {
    const { sendReviewRequestSms } = await import("../src/lib/reputation/review-sends");
    console.log("\n--- Review one-off SMS ---");
    for (const phone of PHONES) {
      const result = await sendReviewRequestSms({
        businessId,
        organizationId,
        customerName: "Cert",
        customerPhone: phone,
        serviceType: "cert",
      });
      console.log(phone, result);
    }
  }

  if (steps.includes("review-list")) {
    const { createReviewCampaign } = await import("../src/lib/reputation/campaigns");
    const dripSequence = [
      { step_key: "initial", step_type: "send_sms", config: {} },
      { step_key: "wait_2m", step_type: "wait", config: { minutes: 2 } },
      { step_key: "reminder_1", step_type: "send_sms", config: { template: "reminder" } },
      { step_key: "end", step_type: "end", config: {} },
    ];

    const recipients = PHONES.map((phone, i) => ({
      row_index: i + 1,
      phone,
      status: "ready" as const,
      first_name: "Cert",
      full_name: `Cert ${phone.slice(-4)}`,
    }));

    console.log("\n--- Review list campaign (2-step drip) ---");
    reviewCampaign = await createReviewCampaign({
      organizationId,
      businessId,
      name: `Review cert two-phone ${new Date().toISOString().slice(0, 16)}`,
      channel: "sms",
      dailySendLimit: 50,
      sendDays: [0, 1, 2, 3, 4, 5, 6],
      sendWindowStart: "00:00",
      sendWindowEnd: "23:59",
      timezone: "America/New_York",
      duplicateProtectionDays: 0,
      startDate: new Date().toISOString().slice(0, 10),
      consentConfirmed: true,
      mapping: { phone: "phone", first_name: "first_name" },
      recipients,
      status: "active",
      sequence: dripSequence,
    });
    console.log("review campaign", reviewCampaign.campaign.id);

    const { enqueueDueCampaignMessages } = await import("../src/lib/reputation/campaign-processor");
    const enqueued = await enqueueDueCampaignMessages(20);
    console.log("review jobs enqueued", enqueued);
  }

  if (steps.includes("mass-list")) {
    const { createBroadcastCampaign } = await import("../src/lib/mass-texting/broadcast/service");
    const { launchCampaignWithAudit } = await import("../src/lib/mass-texting/campaign-launch");

    console.log("\n--- Mass text (2 contacts) ---");
    mass = await createBroadcastCampaign(WORKSPACE_ID, {
      name: `Mass cert two-phone ${new Date().toISOString().slice(0, 16)}`,
      message: `Transovo mass cert two-phone list test ${Date.now()}`,
      audience: {
        include: contacts.map((c) => ({
          type: "contact" as const,
          id: c.id,
          name: c.phone,
        })),
        exclude: [],
      },
      senderMode: "PLATFORM",
      scheduleMode: "now",
    });
    const launch = await launchCampaignWithAudit({
      workspaceId: WORKSPACE_ID,
      campaignId: mass.id,
      idempotencyKey: `cert-two-phone-${mass.id}`,
      confirmLargeSend: true,
    });
    console.log("mass launch", launch);

    const { enqueueDueCampaignMessages: enqueueMass } = await import(
      "../src/lib/campaigns/campaign-processor"
    );
    await enqueueMass(WORKSPACE_ID);
  }

  console.log("\n--- Poll message rows (10s) ---");
  await new Promise((r) => setTimeout(r, 10_000));

  const massMsgs = mass
    ? await prisma.message.findMany({
        where: { workspaceId: WORKSPACE_ID, to: { in: PHONES }, campaignId: mass.id },
        select: { to: true, status: true, createdAt: true },
      })
    : [];
  if (mass) console.log("mass messages", massMsgs);

  const supabasePoll = createServiceClient();

  const { data: reviewSends } = await supabasePoll
    .from("review_request_sends")
    .select("recipient_phone, status, error_message, created_at")
    .in("recipient_phone", PHONES)
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("review one-off sends", reviewSends);

  const { data: recipientsForPoll } = await supabasePoll
    .from("review_request_recipients")
    .select("id, phone")
    .in("phone", PHONES);
  const recipientIds = (recipientsForPoll ?? []).map((r) => r.id as string);

  const { data: reviewMsgs } = recipientIds.length
    ? await supabasePoll
        .from("review_request_messages")
        .select("status, step_key, recipient_id")
        .in("recipient_id", recipientIds)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] };
  const phoneByRecipient = new Map(
    (recipientsForPoll ?? []).map((r) => [r.id as string, r.phone as string]),
  );
  console.log(
    "review campaign messages",
    (reviewMsgs ?? []).map((m) => ({
      phone: phoneByRecipient.get(String(m.recipient_id)),
      status: m.status,
      step_key: m.step_key,
    })),
  );

  console.log("\n--- Cert summary ---");
  console.log({
    steps,
    reviewCampaignId: reviewCampaign?.campaign.id ?? null,
    massCampaignId: mass?.id ?? null,
    massDelivered: massMsgs.filter((m) => m.status === "delivered").length,
    massTotal: massMsgs.length,
    reviewCampaignMessageCount: (reviewMsgs ?? []).length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
