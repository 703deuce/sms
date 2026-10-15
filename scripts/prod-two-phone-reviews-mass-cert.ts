#!/usr/bin/env node
/**
 * Production cert: two handsets — review one-offs, review list campaign (drip), mass-text list.
 *
 * Run on app container (has DATABASE_URL + provider keys):
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/prod-two-phone-reviews-mass-cert.ts
 *
 * Env: WORKSPACE_ID (default ws_1), TRANSOVO_SMS_CERT_PHONES (optional override)
 */
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const PHONES = (
  process.env.TRANSOVO_SMS_CERT_PHONES?.trim() || "+15714776175,+17038166017"
)
  .split(/[,;\s]+/)
  .map((p) => normalizeE164(p.trim()))
  .filter(Boolean) as string[];

async function main() {
  process.env.REVIEW_CAMPAIGN_IMMEDIATE_SEND = "true";

  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();

  console.log("workspace", WORKSPACE_ID, "phones", PHONES);

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
  const reviewCampaign = await createReviewCampaign({
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

  const { createBroadcastCampaign } = await import("../src/lib/mass-texting/broadcast/service");
  const { launchCampaignWithAudit } = await import("../src/lib/mass-texting/campaign-launch");

  console.log("\n--- Mass text (2 contacts) ---");
  const mass = await createBroadcastCampaign(WORKSPACE_ID, {
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

  console.log("\n--- Poll message rows (10s) ---");
  await new Promise((r) => setTimeout(r, 10_000));

  const massMsgs = await prisma.message.findMany({
    where: { workspaceId: WORKSPACE_ID, to: { in: PHONES }, campaignId: mass.id },
    select: { to: true, status: true, createdAt: true },
  });
  console.log("mass messages", massMsgs);

  const reviewSends = await prisma.$queryRawUnsafe<
    Array<{ recipient_phone: string; status: string; error_message: string | null }>
  >(
    `SELECT recipient_phone, status, error_message FROM review_request_sends
     WHERE recipient_phone IN (${PHONES.map((p) => `'${p}'`).join(",")})
     ORDER BY created_at DESC LIMIT 10`,
  );
  console.log("review one-off sends", reviewSends);

  const reviewMsgs = await prisma.$queryRawUnsafe<
    Array<{ phone: string; status: string; step_key: string }>
  >(
    `SELECT r.phone, m.status, m.step_key FROM review_request_messages m
     JOIN review_request_recipients r ON r.id = m.recipient_id
     WHERE r.phone IN (${PHONES.map((p) => `'${p}'`).join(",")})
     ORDER BY m.created_at DESC LIMIT 20`,
  );
  console.log("review campaign messages", reviewMsgs);

  const { sendCampaignMessageById } = await import("../src/lib/reputation/campaign-message-send");
  const queuedReview = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT m.id FROM review_request_messages m
     JOIN review_request_recipients r ON r.id = m.recipient_id
     WHERE r.phone IN (${PHONES.map((p) => `'${p}'`).join(",")}) AND m.status IN ('queued','sending')
     LIMIT 10`,
  );
  for (const row of queuedReview) {
    const out = await sendCampaignMessageById(row.id);
    console.log("review send", row.id, out);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
