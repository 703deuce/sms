/**
 * caller_replied / urgent_detected → routing matrix → mctbNotificationDelivery → email send hook.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-brevo-handoff-delivery-e2e.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { getPrisma } from "../src/lib/db";
import { deliverMctbHandoffNotifications } from "../src/lib/mctb/handoff/notifications";
import { DEFAULT_ROUTING_MATRIX } from "../src/lib/mctb/handoff/defaults";
import { grantWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";
const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.log("test-mctb-brevo-handoff-delivery-e2e: SKIP (no DATABASE_URL)");
  process.exit(0);
}

async function createWorkspaceWithRecipient() {
  const prisma = getPrisma();
  const workspaceId = `mctb_brevo_${randomUUID().slice(0, 10)}`;
  const userId = randomUUID();
  const email = `mctb-brevo-${randomUUID().slice(0, 6)}@transovo.test`;

  await prisma.user.create({
    data: {
      id: userId,
      email,
      name: "Brevo cert",
      passwordHash: await hash("unused", 4),
    },
  });
  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: "MCTB Brevo E2E",
      slug: `mctb-br-${randomUUID().slice(0, 8)}`,
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
      email,
      enabled: true,
      sortOrder: 0,
      eventChannelsJson: {
        caller_replied: { email: true },
        urgent_detected: { email: true },
      },
    },
  });

  const matrixOn = {
    ...DEFAULT_ROUTING_MATRIX,
    caller_replied: { channels: { email: true, in_app: false, sms: false }, recipientIds: [recipient.id] },
    urgent_detected: { channels: { email: true, in_app: false, sms: false }, recipientIds: [recipient.id] },
  };

  await prisma.mctbHandoffConfig.create({
    data: {
      workspaceId,
      routingMatrixJson: matrixOn,
      fieldSchemaJson: [],
    },
  });

  return { workspaceId, recipientId: recipient.id, email };
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

  const { workspaceId } = await createWorkspaceWithRecipient();
  const prisma = getPrisma();

  try {
    const handoffId = randomUUID();
    await prisma.mctbHandoffEvent.create({
      data: {
        id: handoffId,
        workspaceId,
        eventType: "caller_replied",
        idempotencyKey: `cert:${randomUUID()}`,
      },
    });

    const first = await deliverMctbHandoffNotifications({
      workspaceId,
      handoffEventId: handoffId,
      eventType: "caller_replied",
      facts: { callerPhone: "+15555550111" },
    });
    assert.ok(first.delivered.some((d) => d.channel === "email" && d.status === "sent"));

    const deliveries = await prisma.mctbNotificationDelivery.findMany({
      where: { handoffEventId: handoffId, channel: "email" },
    });
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0]?.status, "sent");

    await deliverMctbHandoffNotifications({
      workspaceId,
      handoffEventId: handoffId,
      eventType: "caller_replied",
      facts: { callerPhone: "+15555550111" },
    });
    const afterReplay = await prisma.mctbNotificationDelivery.count({
      where: { handoffEventId: handoffId, channel: "email" },
    });
    assert.equal(afterReplay, 1, "email delivery idempotent");

    const urgentId = randomUUID();
    await prisma.mctbHandoffEvent.create({
      data: {
        id: urgentId,
        workspaceId,
        eventType: "urgent_detected",
        idempotencyKey: `cert:urgent:${randomUUID()}`,
      },
    });
    const urgentResult = await deliverMctbHandoffNotifications({
      workspaceId,
      handoffEventId: urgentId,
      eventType: "urgent_detected",
      urgent: true,
      facts: { callerPhone: "+15555550112" },
    });
    assert.ok(urgentResult.delivered.some((d) => d.channel === "email" && d.status === "sent"));

    await prisma.mctbHandoffConfig.update({
      where: { workspaceId },
      data: {
        routingMatrixJson: {
          ...DEFAULT_ROUTING_MATRIX,
          caller_replied: { channels: { email: false }, recipientIds: [] },
        },
      },
    });
    const offId = randomUUID();
    await prisma.mctbHandoffEvent.create({
      data: {
        id: offId,
        workspaceId,
        eventType: "caller_replied",
        idempotencyKey: `cert:off:${randomUUID()}`,
      },
    });
    const off = await deliverMctbHandoffNotifications({
      workspaceId,
      handoffEventId: offId,
      eventType: "caller_replied",
      facts: { callerPhone: "+15555550113" },
    });
    assert.equal(
      off.delivered.filter((d) => d.channel === "email").length,
      0,
      "matrix email off suppresses send",
    );

    console.log("test-mctb-brevo-handoff-delivery-e2e: PASS");
  } finally {
    await cleanup(workspaceId);
    if (prevCapture === undefined) delete process.env.MCTB_HANDOFF_EMAIL_TEST_CAPTURE;
    else process.env.MCTB_HANDOFF_EMAIL_TEST_CAPTURE = prevCapture;
    if (prevBrevo === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = prevBrevo;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
