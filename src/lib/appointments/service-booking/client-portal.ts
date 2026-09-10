import "server-only";

import { getPrisma } from "@/lib/db";
import { generateSecureToken, hashToken } from "./crypto";
import { listEligibleEntitlementsForContact } from "./entitlements";
import { buildPortalCustomerPayload } from "./portal-customer-payload";

export async function createClientPortalSession(workspaceId: string, contactId: string) {
  const prisma = getPrisma();
  const rawToken = generateSecureToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 3_600_000);
  const session = await prisma.clientPortalSession.create({
    data: {
      workspaceId,
      contactId,
      tokenHash: hashToken(rawToken),
      expiresAt,
    },
  });
  return { session, rawToken, expiresAt };
}

export async function resolveClientPortalSession(token: string) {
  const prisma = getPrisma();
  const session = await prisma.clientPortalSession.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const appointments = await prisma.voiceAppointment.findMany({
    where: { workspaceId: session.workspaceId, contactId: session.contactId },
    orderBy: { startsAt: "desc" },
    take: 50,
  });
  const appointmentIds = appointments.map((a: (typeof appointments)[number]) => a.id);

  const [entitlements, waitlist, workspace, packageLedgers, payments] = await Promise.all([
    listEligibleEntitlementsForContact(session.workspaceId, session.contactId),
    prisma.appointmentWaitlistEntry.findMany({
      where: { workspaceId: session.workspaceId, contactId: session.contactId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workspace.findUnique({
      where: { id: session.workspaceId },
      select: { slug: true },
    }),
    prisma.packageLedgerEntry.findMany({
      where: {
        balance: { workspaceId: session.workspaceId, contactId: session.contactId },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { balance: { include: { product: true } } },
    }),
    appointmentIds.length
      ? prisma.appointmentMerchantPayment.findMany({
          where: {
            workspaceId: session.workspaceId,
            appointmentId: { in: appointmentIds },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            amountPaidCents: true,
            status: true,
            createdAt: true,
            provider: true,
            appointmentId: true,
          },
        })
      : Promise.resolve([]),
  ]);

  await prisma.clientPortalSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  const customerPayload = await buildPortalCustomerPayload(
    session.workspaceId,
    session.contactId,
    workspace?.slug,
  );

  return {
    session: {
      id: session.id,
      workspaceId: session.workspaceId,
      contactId: session.contactId,
      expiresAt: session.expiresAt.toISOString(),
    },
    workspaceSlug: workspace?.slug,
    ...customerPayload,
    appointments: customerPayload.appointments.map((a) => ({
      id: a.id,
      serviceName: a.serviceName,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      status: a.status,
      metadata: { manageAppointmentUrl: a.manageAppointmentUrl },
      staffName: a.staffName,
      locationLabel: a.locationLabel,
      meetingLink: a.meetingLink,
      pendingApproval: a.pendingApproval,
      paymentSummary: a.paymentSummary,
    })),
    entitlements: {
      ...entitlements,
      gifts: entitlements.gifts.map((g: (typeof entitlements.gifts)[number]) => ({
        ...g,
        code: g.code && g.code.length > 4 ? `•••• ${g.code.slice(-4)}` : g.code ? "••••" : undefined,
      })),
    },
    packagePurchaseHistory: packageLedgers
      .filter((e: (typeof packageLedgers)[number]) => e.kind === "purchase")
      .map((e: (typeof packageLedgers)[number]) => ({
        id: e.id,
        kind: e.kind,
        delta: e.delta,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
        productName: e.balance?.product?.name,
      })),
    packageUsageHistory: packageLedgers
      .filter(
        (e: (typeof packageLedgers)[number]) =>
          e.kind === "redeem" || e.kind === "adjustment" || e.kind === "restore",
      )
      .map((e: (typeof packageLedgers)[number]) => ({
        id: e.id,
        kind: e.kind,
        delta: e.delta,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
        productName: e.balance?.product?.name,
      })),
    paymentHistory: payments.map((p: (typeof payments)[number]) => ({
      id: p.id,
      amountCents: p.amountPaidCents,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      provider: p.provider,
      appointmentId: p.appointmentId,
    })),
    waitlist: waitlist.map((w: { id: string; serviceName?: string | null; status?: string }) => ({
      id: w.id,
      serviceName: w.serviceName,
      status: w.status,
    })),
  };
}

export async function revokeClientPortalSession(token: string) {
  const prisma = getPrisma();
  const session = await prisma.clientPortalSession.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!session) return false;
  await prisma.clientPortalSession.delete({ where: { id: session.id } });
  return true;
}

export function clientPortalUrl(baseUrl: string, token: string) {
  return `${baseUrl.replace(/\/$/, "")}/portal/${token}`;
}
