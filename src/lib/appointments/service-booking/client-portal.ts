import "server-only";

import { getPrisma } from "@/lib/db";
import { generateSecureToken, hashToken } from "./crypto";
import { listEligibleEntitlementsForContact } from "./entitlements";

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

  const [appointments, entitlements, waitlist, workspace, packageLedgers] = await Promise.all([
    prisma.voiceAppointment.findMany({
      where: { workspaceId: session.workspaceId, contactId: session.contactId },
      orderBy: { startsAt: "desc" },
      take: 50,
    }),
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
  ]);

  await prisma.clientPortalSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    session,
    workspaceSlug: workspace?.slug,
    appointments: appointments.map((a: (typeof appointments)[number]) => ({
      id: a.id,
      serviceName: a.serviceName,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt?.toISOString(),
      status: a.status,
      metadata: a.metadata as { manageAppointmentUrl?: string },
    })),
    upcomingAppointments: appointments
      .filter((a) => a.startsAt > new Date() && !["canceled", "cancelled", "completed", "no_show"].includes(a.status))
      .map((a) => ({
        id: a.id,
        serviceName: a.serviceName,
        startsAt: a.startsAt.toISOString(),
        status: a.status,
      })),
    pastAppointments: appointments
      .filter((a) => a.startsAt <= new Date() || ["completed", "no_show", "canceled", "cancelled"].includes(a.status))
      .map((a) => ({
        id: a.id,
        serviceName: a.serviceName,
        startsAt: a.startsAt.toISOString(),
        status: a.status,
      })),
    entitlements,
    packagePurchaseHistory: packageLedgers.filter((e) => e.kind === "purchase"),
    packageUsageHistory: packageLedgers.filter((e) => e.kind === "redeem" || e.kind === "adjustment"),
    waitlist,
  };
}

export function clientPortalUrl(baseUrl: string, token: string) {
  return `${baseUrl.replace(/\/$/, "")}/portal/${token}`;
}
