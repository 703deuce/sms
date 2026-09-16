/**
 * Seed a stable Mass Texting browser-cert user/workspace with known counts.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/seed-mass-texting-browser-cert.ts
 */
import { writeFileSync } from "node:fs";
import { hash } from "bcryptjs";
import { getPrisma } from "../src/lib/db";
import { grantWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";
import { grantProductEntitlement } from "../src/lib/products/entitlements";
import {
  getOrCreateMassTextingBillingAccount,
} from "../src/lib/mass-texting/billing-account";
import { activateMassTextingTrial } from "../src/lib/mass-texting/trial-lifecycle";
import { loadMassTextOverviewMetrics } from "../src/lib/mass-texting/overview-metrics";
import { buildPreSendReview } from "../src/lib/mass-texting/pre-send-review";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";
import { assertE164AssignableToWorkspace } from "../src/lib/phone/e164-workspace-uniqueness";

export const CERT_BROWSER_EMAIL = "mt-cert-browser@transovo.test";
const CERT_NAME = "Mass Text Cert Browser";
const CERT_WORKSPACE_SLUG = "mt-browser-cert";
const SENDER_E164 = "+15555550171";

async function resetWorkspaceData(workspaceId: string) {
  const prisma = getPrisma();
  const lists = await prisma.contactList.findMany({ where: { workspaceId }, select: { id: true } });
  for (const list of lists) {
    await prisma.contactListMember.deleteMany({ where: { listId: list.id } });
  }
  await prisma.contactList.deleteMany({ where: { workspaceId } });
  await prisma.campaignMessage.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaignRecipient.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaignLaunchAudit.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaign.deleteMany({ where: { workspaceId } });
  await prisma.conversationMessage
    .deleteMany({ where: { conversation: { workspaceId } } })
    .catch(async () => {
      const convos = await prisma.conversation.findMany({ where: { workspaceId }, select: { id: true } });
      for (const c of convos) {
        await prisma.conversationMessage.deleteMany({ where: { conversationId: c.id } });
      }
    });
  await prisma.conversation.deleteMany({ where: { workspaceId } });
  await prisma.suppression.deleteMany({ where: { workspaceId } });
  await prisma.contact.deleteMany({ where: { workspaceId } });
  await prisma.template.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.massTextingCreditReservation.deleteMany({ where: { workspaceId } }).catch(() => {});
}

async function main() {
  const prisma = getPrisma();
  const passwordHash = await hash("CertBrowser_mt_v1!", 10);
  let user = await prisma.user.findUnique({ where: { email: CERT_BROWSER_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: CERT_BROWSER_EMAIL,
        name: CERT_NAME,
        passwordHash,
        phone: "+15550001901",
        phoneVerifiedAt: new Date(),
        isPlatformAdmin: false,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, name: CERT_NAME },
    });
  }

  const enforceSingleWs = process.env.TRANSOVO_ENFORCE_SINGLE_WORKSPACE === "1";
  let workspace = enforceSingleWs
    ? await prisma.workspace.findUnique({ where: { id: "ws_1" } })
    : await prisma.workspace.findUnique({ where: { slug: CERT_WORKSPACE_SLUG } });
  if (!workspace && !enforceSingleWs) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Mass Texting Browser Cert",
        slug: CERT_WORKSPACE_SLUG,
        type: "BUSINESS",
        ownerUserId: user.id,
        billingPlan: "trial",
      },
    });
  }
  if (!workspace) {
    throw new Error(
      enforceSingleWs
        ? "TRANSOVO_ENFORCE_SINGLE_WORKSPACE=1 but ws_1 is missing"
        : "Cert workspace missing and creation disabled",
    );
  }

  const existingMembership = await prisma.membership.findFirst({
    where: { userId: user.id, workspaceId: workspace.id },
  });
  if (!existingMembership) {
    await prisma.membership.create({
      data: { userId: user.id, workspaceId: workspace.id, role: "OWNER" },
    });
  }

  await grantProductEntitlement(workspace.id, "sms", "trial");
  await grantWorkspaceProductFeature(workspace.id, "mass_texting", "trial");
  await resetWorkspaceData(workspace.id);

  await prisma.messagingProductRegistration.upsert({
    where: {
      workspaceId_productUseCase: {
        workspaceId: workspace.id,
        productUseCase: "MASS_TEXT_MARKETING",
      },
    },
    create: {
      workspaceId: workspace.id,
      productUseCase: "MASS_TEXT_MARKETING",
      overallStatus: "approved",
      messagingEnabled: true,
      phoneAttached: true,
      phoneE164: SENDER_E164,
    },
    update: {
      overallStatus: "approved",
      messagingEnabled: true,
      phoneAttached: true,
      phoneE164: SENDER_E164,
    },
  });

  await prisma.messagingRegistration.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      overallStatus: "ready",
      messagingEnabled: true,
      phoneAttached: true,
      phoneE164: SENDER_E164,
      brandStatus: "approved",
      campaignStatus: "approved",
      messagingProfileId: "mock-profile",
      campaignId: "mock-campaign",
      messagingProvider: "mock",
      messagingServiceSid: "mock-service",
      useCase: "mixed",
    },
    update: {
      overallStatus: "ready",
      messagingEnabled: true,
      phoneAttached: true,
      phoneE164: SENDER_E164,
      brandStatus: "approved",
      campaignStatus: "approved",
      messagingProfileId: "mock-profile",
      campaignId: "mock-campaign",
      messagingProvider: "mock",
      messagingServiceSid: "mock-service",
      useCase: "mixed",
    },
  });

  await assertE164AssignableToWorkspace(workspace.id, SENDER_E164);

  await prisma.phoneNumber.upsert({
    where: { workspaceId_e164: { workspaceId: workspace.id, e164: SENDER_E164 } },
    create: {
      workspaceId: workspace.id,
      e164: SENDER_E164,
      type: "local",
      status: "Active",
      a2pStatus: "APPROVED",
      settingsJson: { massTextRole: "primary" },
    },
    update: {
      status: "Active",
      settingsJson: { massTextRole: "primary" },
    },
  }).catch(async () => {
    await prisma.phoneNumber.create({
      data: {
        workspaceId: workspace.id,
        e164: SENDER_E164,
        type: "local",
        status: "Active",
        a2pStatus: "APPROVED",
        settingsJson: { massTextRole: "primary" },
      },
    });
  });

  await getOrCreateMassTextingBillingAccount(workspace.id);
  const trial = await activateMassTextingTrial(workspace.id);
  if (!trial.ok) {
    throw new Error(`Trial did not activate: ${JSON.stringify(trial)}`);
  }

  const subscribedPhones = Array.from({ length: 12 }, (_, i) =>
    normalizeE164(`555-218-${String(1000 + i).slice(-4)}`),
  );
  const unsubPhone = normalizeE164("555-218-1999");
  const blockedPhone = normalizeE164("555-218-1998");

  const subscribed = [];
  for (let i = 0; i < subscribedPhones.length; i += 1) {
    subscribed.push(
      await prisma.contact.create({
        data: {
          workspaceId: workspace.id,
          phone: subscribedPhones[i],
          firstName: `Sub${i + 1}`,
          lastName: "Cert",
          status: "SUBSCRIBED",
          consentSource: "seed",
          consentDate: new Date(),
        },
      }),
    );
  }
  const unsub = await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      phone: unsubPhone,
      firstName: "Unsub",
      lastName: "Cert",
      status: "UNSUBSCRIBED",
    },
  });
  await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      phone: blockedPhone,
      firstName: "Blocked",
      lastName: "Cert",
      status: "BLOCKED",
    },
  });

  const promoList = await prisma.contactList.create({
    data: { workspaceId: workspace.id, name: "August Promo" },
  });
  const overlapList = await prisma.contactList.create({
    data: { workspaceId: workspace.id, name: "Overlap List" },
  });
  const shortageList = await prisma.contactList.create({
    data: { workspaceId: workspace.id, name: "Credit Shortage List" },
  });

  for (const contact of subscribed.slice(0, 5)) {
    await prisma.contactListMember.create({ data: { listId: promoList.id, contactId: contact.id } });
  }
  for (const contact of subscribed.slice(3, 6)) {
    await prisma.contactListMember.create({
      data: { listId: overlapList.id, contactId: contact.id },
    });
  }
  for (const contact of subscribed) {
    await prisma.contactListMember.create({
      data: { listId: shortageList.id, contactId: contact.id },
    });
  }

  await prisma.suppression.create({
    data: {
      workspaceId: workspace.id,
      phone: unsubPhone,
      suppressionKey: `${workspace.id}:p:${unsubPhone}`,
      reason: "STOP",
      source: "seed",
    },
  });

  await prisma.template.create({
    data: {
      workspaceId: workspace.id,
      name: "Labor Day Promo",
      category: "promotion",
      type: "sms",
      channel: "SMS",
      body: "Hi {{first_name}}, Labor Day sale is on. Reply STOP to opt out.",
      shared: true,
      tags: ["mass_text"],
    },
  });

  const decoy = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "MCTB decoy (must not count)",
      type: "Missed Call",
      category: "missed_call",
      audience: "Callers",
      body: "We missed your call",
      status: "COMPLETED",
      sent: 999,
      delivered: 999,
      replies: 50,
      optOuts: 20,
      configJson: { productSource: "mctb" },
    },
  });

  const sentCampaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "Sent Labor Day",
      type: "Promotion",
      category: "promotion",
      audience: "List",
      body: "Thanks for shopping. Reply STOP to opt out.",
      status: "COMPLETED",
      sent: 10,
      delivered: 9,
      replies: 2,
      optOuts: 1,
      configJson: { productSource: "mass_text", massTexting: true, listIds: [promoList.id] },
    },
  });
  await prisma.campaignLaunchAudit.create({
    data: {
      workspaceId: workspace.id,
      campaignId: sentCampaign.id,
      idempotencyKey: `browser-cert-sent:${workspace.id}`,
      rawContactCount: 10,
      finalRecipientCount: 10,
      estimatedSegments: 10,
      phoneE164: SENDER_E164,
    },
  });

  for (let i = 0; i < 10; i += 1) {
    const recipient = await prisma.campaignRecipient.create({
      data: {
        workspaceId: workspace.id,
        campaignId: sentCampaign.id,
        contactId: subscribed[i % subscribed.length].id,
        phone: subscribed[i % subscribed.length].phone,
        displayName: subscribed[i % subscribed.length].firstName,
        enrollmentKey: `browser-cert:${sentCampaign.id}:${i}`,
        workflowStatus: "completed",
      },
    });
    await prisma.campaignMessage.create({
      data: {
        workspaceId: workspace.id,
        campaignId: sentCampaign.id,
        recipientId: recipient.id,
        to: subscribed[i % subscribed.length].phone,
        body: sentCampaign.body,
        status: i === 9 ? "sent" : "delivered",
        sentAt: new Date(),
        stepKey: `step-${i}`,
      },
    });
  }
  await prisma.campaign.update({
    where: { id: sentCampaign.id },
    data: { sent: 10, delivered: 9, replies: 2, optOuts: 1 },
  });

  const draftCampaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "August Draft",
      type: "Promotion",
      category: "promotion",
      audience: "List",
      body: "Hi {{first_name}}, August promo is live. Reply STOP to opt out.",
      status: "DRAFT",
      configJson: {
        productSource: "mass_text",
        massTexting: true,
        listIds: [promoList.id, overlapList.id],
      },
    },
  });

  const longBody =
    "Hi {{first_name}}, this is a long Mass Texting credit-shortage fixture. ".repeat(30) +
    "Reply STOP to opt out.";
  const shortageCampaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "Credit Shortage",
      type: "Promotion",
      category: "promotion",
      audience: "List",
      body: longBody,
      status: "DRAFT",
      configJson: {
        productSource: "mass_text",
        massTexting: true,
        listIds: [shortageList.id],
      },
    },
  });

  const mtConvo = await prisma.conversation.create({
    data: {
      workspaceId: workspace.id,
      contactId: subscribed[0].id,
      status: "OPEN",
      unread: true,
      productSource: "MASS_TEXT",
      fromE164: subscribed[0].phone,
      campaignId: sentCampaign.id,
      tags: [],
    },
  });
  await prisma.conversationMessage.create({
    data: {
      conversationId: mtConvo.id,
      direction: "inbound",
      body: "Is the sale still on?",
      fromE164: subscribed[0].phone,
    },
  });

  const mctbConvo = await prisma.conversation.create({
    data: {
      workspaceId: workspace.id,
      contactId: subscribed[1].id,
      status: "OPEN",
      unread: true,
      productSource: "MCTB",
      fromE164: subscribed[1].phone,
      tags: [],
    },
  });
  await prisma.conversationMessage.create({
    data: {
      conversationId: mctbConvo.id,
      direction: "inbound",
      body: "Missed your call, thanks for the text back",
      fromE164: subscribed[1].phone,
    },
  });

  const draftReview = await buildPreSendReview(workspace.id, draftCampaign.id);
  const shortageReview = await buildPreSendReview(workspace.id, shortageCampaign.id);
  const metrics = await loadMassTextOverviewMetrics(workspace.id);

  const fixture = {
    email: CERT_BROWSER_EMAIL,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    senderE164: SENDER_E164,
    senderDisplay: "+1 (555) 555-0171",
    contactsTotal: 14,
    subscribedCount: 12,
    unsubscribedCount: 1,
    blockedCount: 1,
    lists: {
      augustPromo: { id: promoList.id, name: promoList.name, members: 5 },
      overlap: { id: overlapList.id, name: overlapList.name, members: 3 },
      shortage: { id: shortageList.id, name: shortageList.name, members: 12 },
    },
    campaigns: {
      decoyId: decoy.id,
      sentId: sentCampaign.id,
      draftId: draftCampaign.id,
      shortageId: shortageCampaign.id,
    },
    metrics,
    draftReview,
    shortageReview,
    inbox: {
      massText: 1,
      mctb: 1,
      all: 2,
    },
  };

  writeFileSync("/tmp/mt-browser-cert.json", JSON.stringify(fixture, null, 2));
  writeFileSync("/opt/cursor/artifacts/mt-browser-cert-fixtures.json", JSON.stringify(fixture, null, 2));
  console.log(JSON.stringify({ ok: true, trial: trial.ok, fixture }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
