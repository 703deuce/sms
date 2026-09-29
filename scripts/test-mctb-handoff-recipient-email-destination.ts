#!/usr/bin/env tsx
/**
 * Proves handoff email delivery uses configured recipient.email, not workspace member login email.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-handoff-recipient-email-destination.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { getPrisma } from "../src/lib/db";
import { DEFAULT_ROUTING_MATRIX } from "../src/lib/mctb/handoff/defaults";
import { grantWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";
import { drainMctbHandoffTestEmailCapture } from "../src/lib/email/brevo";

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.log("test-mctb-handoff-recipient-email-destination: SKIP (no DATABASE_URL)");
  process.exit(0);
}

async function cleanup(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.mctbNotificationDelivery.deleteMany({ where: { workspaceId } });
  await prisma.mctbHandoffEvent.deleteMany({ where: { workspaceId } });
  await prisma.mctbNotificationRecipient.deleteMany({ where: { workspaceId } });
  await prisma.mctbHandoffConfig.deleteMany({ where: { workspaceId } });
  const memberships = await prisma.membership.findMany({ where: { workspaceId }, select: { userId: true } });
  for (const m of memberships) {
    await prisma.user.delete({ where: { id: m.userId } }).catch(() => undefined);
  }
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
}

async function main() {
  const prevBrevo = process.env.BREVO_API_KEY;
  const prevCapture = process.env.MCTB_HANDOFF_EMAIL_TEST_CAPTURE;
  process.env.MCTB_HANDOFF_EMAIL_TEST_CAPTURE = "1";
  process.env.BREVO_API_KEY = "";
  drainMctbHandoffTestEmailCapture();

  const { deliverMctbHandoffNotifications } = await import("../src/lib/mctb/handoff/notifications");

  const prisma = getPrisma();
  const workspaceId = `mctb_rcpt_${randomUUID().slice(0, 10)}`;
  const userId = randomUUID();
  const memberEmail = `member-${randomUUID().slice(0, 6)}@transovo.test`;
  const recipientEmail = `ops-${randomUUID().slice(0, 6)}@transovo.test`;

  await prisma.user.create({
    data: {
      id: userId,
      email: memberEmail,
      name: "Owner",
      passwordHash: await hash("unused", 4),
    },
  });
  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: "Recipient email test",
      slug: `mctb-re-${randomUUID().slice(0, 8)}`,
      type: "BUSINESS",
      billingPlan: "trial",
      memberships: { create: { userId, role: "OWNER" } },
    },
  });
  await grantWorkspaceProductFeature(workspaceId, "mctb", "active");

  const recipient = await prisma.mctbNotificationRecipient.create({
    data: {
      workspaceId,
      name: "Ops",
      email: recipientEmail,
      enabled: true,
      sortOrder: 0,
      eventChannelsJson: { caller_replied: { email: true } },
    },
  });

  await prisma.mctbHandoffConfig.create({
    data: {
      workspaceId,
      routingMatrixJson: {
        ...DEFAULT_ROUTING_MATRIX,
        caller_replied: {
          channels: { email: true, in_app: false, sms: false },
          recipientIds: [recipient.id],
        },
      },
      fieldSchemaJson: [],
    },
  });

  const handoffId = randomUUID();
  await prisma.mctbHandoffEvent.create({
    data: {
      id: handoffId,
      workspaceId,
      eventType: "caller_replied",
      idempotencyKey: `cert:${randomUUID()}`,
    },
  });

  try {
    const first = await deliverMctbHandoffNotifications({
      workspaceId,
      handoffEventId: handoffId,
      eventType: "caller_replied",
      facts: { callerPhone: "+15555550199" },
    });

    const sentTo = drainMctbHandoffTestEmailCapture();
    assert.equal(sentTo.length, 1, `exactly one transactional email send (delivered=${JSON.stringify(first.delivered)})`);
    assert.equal(sentTo[0], recipientEmail, "email must go to configured recipient");
    assert.notEqual(sentTo[0], memberEmail, "must not use workspace member login email");

    const row = await prisma.mctbNotificationDelivery.findFirst({
      where: { handoffEventId: handoffId, channel: "email" },
    });
    assert.equal(row?.status, "sent");
    assert.equal(row?.destination, recipientEmail);

    const updatedEmail = `updated-${randomUUID().slice(0, 6)}@transovo.test`;
    await prisma.mctbNotificationRecipient.update({
      where: { id: recipient.id },
      data: { email: updatedEmail },
    });

    const handoffId2 = randomUUID();
    await prisma.mctbHandoffEvent.create({
      data: {
        id: handoffId2,
        workspaceId,
        eventType: "caller_replied",
        idempotencyKey: `cert:${randomUUID()}`,
      },
    });
    await deliverMctbHandoffNotifications({
      workspaceId,
      handoffEventId: handoffId2,
      eventType: "caller_replied",
      facts: { callerPhone: "+15555550200" },
    });
    const sentTo2 = drainMctbHandoffTestEmailCapture();
    assert.equal(sentTo2[0], updatedEmail, "after edit, delivery uses new recipient email");

    console.log("test-mctb-handoff-recipient-email-destination: PASS");
  } finally {
    if (prevBrevo === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = prevBrevo;
    if (prevCapture === undefined) delete process.env.MCTB_HANDOFF_EMAIL_TEST_CAPTURE;
    else process.env.MCTB_HANDOFF_EMAIL_TEST_CAPTURE = prevCapture;
    drainMctbHandoffTestEmailCapture();
    await cleanup(workspaceId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
