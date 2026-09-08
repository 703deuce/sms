/**
 * Service-booking entitlement flow certification (API-level, prisma-only).
 * Mirrors booking-entitlements runtime without importing server-only modules.
 *
 * Usage:
 *   npx tsx scripts/cert-service-booking-entitlements.ts
 */
import { getPrisma } from "@/lib/db";

const WORKSPACE_SLUG = process.env.CERT_WORKSPACE_SLUG || "cert-appointments-mctb";

function packageCreditsRemaining(remainingCredits: Record<string, number>): number {
  return Object.values(remainingCredits).reduce((sum, n) => sum + (n || 0), 0);
}

async function main() {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findFirst({ where: { slug: WORKSPACE_SLUG } });
  if (!workspace) {
    console.error(`FAIL: workspace ${WORKSPACE_SLUG} not found — run cert bootstrap first`);
    process.exit(1);
  }

  const contact = await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      firstName: "Cert",
      lastName: "Entitlement",
      phone: `+1555${String(Date.now()).slice(-7)}`,
      status: "SUBSCRIBED",
      consentSource: "cert",
      consentDate: new Date(),
    },
  });

  const type = await prisma.voiceService.findFirst({
    where: { workspaceId: workspace.id },
  });
  if (!type) {
    console.error("FAIL: no active appointment type in cert workspace");
    process.exit(1);
  }

  const product = await prisma.packageProduct.create({
    data: {
      workspaceId: workspace.id,
      name: `Cert 5-pack ${Date.now()}`,
      slug: `cert-5-pack-${Date.now()}`,
      priceCents: 10000,
      creditRules: [{ bookingTypeId: type.id, quantity: 5 }],
      active: true,
    },
  });

  const balance = await prisma.packageBalance.create({
    data: {
      workspaceId: workspace.id,
      productId: product.id,
      contactId: contact.id,
      remainingCredits: { [type.id]: 5 },
      status: "active",
    },
  });

  const before = packageCreditsRemaining((balance.remainingCredits || {}) as Record<string, number>);
  if (before !== 5) {
    console.error(`FAIL: expected 5 credits, got ${before}`);
    process.exit(1);
  }
  console.log(`OK  package purchased — ${before} credits`);

  const appointment = await prisma.voiceAppointment.create({
    data: {
      workspaceId: workspace.id,
      serviceName: type.name,
      phone: contact.phone!,
      contactId: contact.id,
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 86_400_000 + 3_600_000),
      status: "awaiting_confirmation",
      metadata: {},
    },
  });

  const credits = (balance.remainingCredits || {}) as Record<string, number>;
  const creditKey = type.id;
  const current = credits[creditKey] ?? 0;
  const next = { ...credits, [creditKey]: current - 1 };
  await prisma.packageBalance.update({
    where: { id: balance.id },
    data: { remainingCredits: next },
  });
  await prisma.packageLedgerEntry.create({
    data: {
      balanceId: balance.id,
      kind: "redeem",
      delta: { [creditKey]: -1 },
      appointmentId: appointment.id,
      note: `Redeemed for booking type ${type.id}`,
    },
  });

  const afterBalance = await prisma.packageBalance.findUnique({ where: { id: balance.id } });
  const after = packageCreditsRemaining(
    (afterBalance?.remainingCredits || {}) as Record<string, number>,
  );
  if (after !== 4) {
    console.error(`FAIL: expected 4 credits after redeem, got ${after}`);
    process.exit(1);
  }
  console.log(`OK  redeemed package credit — ${after} credits remaining`);

  await prisma.voiceAppointment.update({
    where: { id: appointment.id },
    data: { status: "canceled" },
  });

  const packageEntries = await prisma.packageLedgerEntry.findMany({
    where: { appointmentId: appointment.id, kind: "redeem" },
    include: { balance: true },
  });
  for (const entry of packageEntries) {
    const delta = (entry.delta || {}) as Record<string, number>;
    const remaining = (entry.balance.remainingCredits || {}) as Record<string, number>;
    const restored = { ...remaining };
    for (const [key, value] of Object.entries(delta)) {
      restored[key] = (restored[key] || 0) - value;
    }
    await prisma.packageBalance.update({
      where: { id: entry.balanceId },
      data: { remainingCredits: restored, status: "active" },
    });
    await prisma.packageLedgerEntry.create({
      data: {
        balanceId: entry.balanceId,
        kind: "restore",
        delta: Object.fromEntries(Object.entries(delta).map(([k, v]) => [k, -v])),
        appointmentId: appointment.id,
        note: `Restored after appointment ${appointment.id} canceled`,
      },
    });
  }

  const restoredBalance = await prisma.packageBalance.findUnique({ where: { id: balance.id } });
  const final = packageCreditsRemaining(
    (restoredBalance?.remainingCredits || {}) as Record<string, number>,
  );
  if (final !== 5) {
    console.error(`FAIL: expected 5 credits after restore, got ${final}`);
    process.exit(1);
  }
  console.log(`OK  cancel restored credit — ${final} credits remaining`);

  console.log("\nPASS service-booking entitlement certification");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
