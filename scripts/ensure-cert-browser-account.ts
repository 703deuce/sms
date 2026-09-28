/**
 * Ensure appt-mctb-browser cert user can log in (membership + password).
 * Does not re-run full bootstrap (avoids +18885550199 conflict with ws_1).
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ensure-cert-browser-account.ts
 */
import { hash } from "bcryptjs";
import { getPrisma } from "../src/lib/db";
import {
  CERT_BROWSER_EMAIL,
  CERT_WORKSPACE_SLUG,
} from "../src/lib/cert/appointments-mctb-browser-bootstrap";

const PASSWORD = process.env.CERT_BROWSER_PASSWORD?.trim() || "ApptMctbBrowserCert_v1!";

async function main() {
  const prisma = getPrisma();
  let user = await prisma.user.findUnique({ where: { email: CERT_BROWSER_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: CERT_BROWSER_EMAIL,
        name: "Appt MCTB Browser Cert",
        passwordHash: await hash(PASSWORD, 10),
        phone: "+15555550200",
        phoneVerifiedAt: new Date(),
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(PASSWORD, 10) },
    });
  }

  let workspace = await prisma.workspace.findUnique({ where: { slug: CERT_WORKSPACE_SLUG } });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Appt MCTB Browser Cert",
        slug: CERT_WORKSPACE_SLUG,
        type: "BUSINESS",
        ownerUserId: user.id,
        billingPlan: "trial",
        creditBalanceCents: 500_000,
        messagingRegistration: { create: {} },
        workspaceLimits: {
          create: {
            limits: { dailyCap: 500, maxNumbers: 5, trialDays: 14, requireCard: false },
          },
        },
      },
    });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, workspaceId: workspace.id },
  });
  if (!membership) {
    await prisma.membership.create({
      data: { userId: user.id, workspaceId: workspace.id, role: "OWNER" },
    });
  }

  await prisma.platformProductSubscription.upsert({
    where: {
      workspaceId_productFamily: { workspaceId: workspace.id, productFamily: "mctb" },
    },
    create: {
      workspaceId: workspace.id,
      productFamily: "mctb",
      tier: "starter",
      status: "active",
      stripeSubscriptionId: `cert_sub_${workspace.id}`,
      stripeCustomerId: `cert_cus_${workspace.id}`,
      stripePriceId: "price_cert_mctb_starter",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    },
    update: { status: "active", tier: "starter" },
  });

  const handoffEmail = "handoff-cert@transovo.test";
  const existingRecipient = await prisma.mctbNotificationRecipient.findFirst({
    where: { workspaceId: workspace.id, email: handoffEmail },
  });
  if (!existingRecipient) {
    await prisma.mctbNotificationRecipient.create({
      data: {
        workspaceId: workspace.id,
        name: "Cert Handoff",
        email: handoffEmail,
        enabled: true,
        sortOrder: 0,
        eventChannelsJson: {},
      },
    });
  }

  console.log(`ensure-cert-browser-account: ok user=${user.id} workspace=${workspace.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
