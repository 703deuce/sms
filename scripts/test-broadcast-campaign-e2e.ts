/**
 * Broadcast Campaigns E2E — sends live SMS ONLY to the allowlisted test number.
 *
 * Usage:
 *   $env:ALLOWED_TEST_PHONE="+15714776175"
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-broadcast-campaign-e2e.ts
 */
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { getPrisma } from "../src/lib/db";
import { grantWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";
import { previewBroadcastAudience } from "../src/lib/mass-texting/broadcast/audience";
import {
  createBroadcastCampaign,
  getBroadcastCampaign,
  listBroadcastCampaigns,
} from "../src/lib/mass-texting/broadcast/service";
import { buildPreSendReview } from "../src/lib/mass-texting/pre-send-review";
import { listBroadcastRecipients } from "../src/lib/mass-texting/broadcast/analytics";
import { sendQuickSms } from "../src/lib/sms/send-quick";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";

config({ path: ".env.local" });

const ALLOWED = normalizeE164(process.env.ALLOWED_TEST_PHONE || "+15714776175");
const WORKSPACE_ID = process.env.DEV_ORG_ID || process.env.WORKSPACE_ID || "";

type Step = { name: string; ok: boolean; detail?: string };
const steps: Step[] = [];
const failures: string[] = [];

function pass(name: string, detail?: string) {
  steps.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string) {
  steps.push({ name, ok: false, detail });
  failures.push(`${name}: ${detail}`);
  console.error(`✗ ${name} — ${detail}`);
}

function assertAllowedPhone(to: string) {
  const normalized = normalizeE164(to);
  if (normalized !== ALLOWED) {
    throw new Error(`Refusing to send to ${normalized}; only ${ALLOWED} is allowed`);
  }
  return normalized;
}

async function ensureTestContact(workspaceId: string) {
  const prisma = getPrisma();
  let contact = await prisma.contact.findFirst({
    where: { workspaceId, phone: ALLOWED },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId,
        phone: ALLOWED,
        firstName: "Broadcast",
        lastName: "Cert",
        status: "SUBSCRIBED",
      },
    });
    pass("contact-created", contact.id);
  } else {
    pass("contact-found", contact.id);
  }
  return contact;
}

async function main() {
  if (!WORKSPACE_ID) {
    throw new Error("Set DEV_ORG_ID or WORKSPACE_ID in .env.local");
  }

  console.log(`Workspace: ${WORKSPACE_ID}`);
  console.log(`Allowed test phone: ${ALLOWED}`);

  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({ where: { id: WORKSPACE_ID } });
  if (!workspace) throw new Error(`Workspace not found: ${WORKSPACE_ID}`);
  pass("workspace", workspace.name);

  try {
    await grantWorkspaceProductFeature(workspace.id, "mass_texting", "trial");
  } catch {
    // may already be entitled
  }
  pass("mass-texting-entitlement");

  const contact = await ensureTestContact(workspace.id);

  const audience = {
    include: [{ type: "contact" as const, id: contact.id, name: "Broadcast Cert" }],
    exclude: [] as Array<{ type: "contact"; id: string; name: string }>,
  };

  const preview = await previewBroadcastAudience(workspace.id, audience);
  if (preview.eligibleCount !== 1) {
    fail("audience-preview", `expected 1 eligible, got ${preview.eligibleCount}`);
  } else {
    pass("audience-preview", `eligible=${preview.eligibleCount}`);
  }

  const testBody =
    "Transovo broadcast cert test. Reply STOP to opt out. Msg & data rates may apply.";
  const campaign = await createBroadcastCampaign(
    workspace.id,
    {
      name: `Broadcast cert ${new Date().toISOString().slice(0, 16)}`,
      message: testBody,
      audience,
      scheduleMode: "now",
      timezone: "America/New_York",
    },
    "broadcast-cert-script",
  );
  pass("create-campaign", campaign.id);

  const loaded = await getBroadcastCampaign(workspace.id, campaign.id);
  if (!loaded) fail("get-campaign", "not found");
  else pass("get-campaign", loaded.status);

  const review = await buildPreSendReview(workspace.id, campaign.id);
  if (!review) {
    fail("launch-review", "null review");
  } else if (review.finalRecipientCount !== 1) {
    fail("launch-review", `finalRecipientCount=${review.finalRecipientCount}`);
  } else {
    pass(
      "launch-review",
      `recipients=${review.finalRecipientCount} credits=${review.requiredSegments}`,
    );
  }

  assertAllowedPhone(ALLOWED);
  const testSend = await sendQuickSms({
    workspaceId: workspace.id,
    to: ALLOWED,
    body: `[Test] ${testBody}`,
    idempotencyKey: `broadcast-cert-test:${Date.now()}`,
  });
  pass("test-sms-send", testSend.providerId || testSend.status || "sent");

  const listed = await listBroadcastCampaigns(workspace.id, { take: 5 });
  if (!listed.some((c) => c.id === campaign.id)) {
    fail("list-campaigns", "created campaign missing from list");
  } else {
    pass("list-campaigns", `${listed.length} broadcast campaigns`);
  }

  const recipients = await listBroadcastRecipients(workspace.id, campaign.id);
  if (recipients.length !== 1) {
    fail("recipients", `expected 1 enrolled, got ${recipients.length}`);
  } else {
    pass("recipients", `${recipients[0].phone} ${recipients[0].status}`);
  }

  const report = {
    ok: failures.length === 0,
    workspaceId: workspace.id,
    allowedPhone: ALLOWED,
    campaignId: campaign.id,
    testSend,
    steps,
    failures,
    finishedAt: new Date().toISOString(),
  };
  writeFileSync("broadcast-campaign-e2e-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, failures, campaignId: campaign.id }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
