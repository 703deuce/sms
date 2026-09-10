import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { listEligibleEntitlementsForContact } from "@/lib/appointments/service-booking/entitlements";
import { getWalletBalance, listWalletLedger } from "@/lib/appointments/service-booking/phase2/client-wallet";
import { resolveHouseholdForContact } from "@/lib/appointments/service-booking/household";
import { listClientRestrictions } from "@/lib/appointments/service-booking/client-restrictions";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: contactId } = await context.params;
    const prisma = getPrisma();

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, workspaceId: auth.workspaceId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        customFields: true,
        createdAt: true,
      },
    });
    if (!contact) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [entitlements, wallet, ledger, household, restrictions, apptStats] = await Promise.all([
      listEligibleEntitlementsForContact(auth.workspaceId, contactId),
      getWalletBalance(auth.workspaceId, contactId),
      listWalletLedger(auth.workspaceId, contactId, 25),
      resolveHouseholdForContact(auth.workspaceId, contactId),
      listClientRestrictions(auth.workspaceId),
      prisma.voiceAppointment.groupBy({
        by: ["status"],
        where: { workspaceId: auth.workspaceId, contactId },
        _count: { _all: true },
      }),
    ]);

    const restriction =
      restrictions.find((r: { contactId?: string | null }) => r.contactId === contactId) ?? null;

    const now = new Date();
    const [nextAppt, lastAppt, completedCount] = await Promise.all([
      prisma.voiceAppointment.findFirst({
        where: {
          workspaceId: auth.workspaceId,
          contactId,
          startsAt: { gte: now },
          status: { notIn: ["cancelled", "canceled"] },
        },
        orderBy: { startsAt: "asc" },
        select: { id: true, startsAt: true, serviceName: true, status: true },
      }),
      prisma.voiceAppointment.findFirst({
        where: {
          workspaceId: auth.workspaceId,
          contactId,
          startsAt: { lt: now },
        },
        orderBy: { startsAt: "desc" },
        select: { id: true, startsAt: true, serviceName: true, status: true },
      }),
      prisma.voiceAppointment.count({
        where: {
          workspaceId: auth.workspaceId,
          contactId,
          status: { in: ["completed", "checked_out", "confirmed"] },
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        contact,
        overview: {
          nextAppointment: nextAppt,
          lastAppointment: lastAppt,
          completedAppointments: completedCount,
          appointmentByStatus: apptStats,
        },
        entitlements,
        accountCredit: wallet,
        creditHistory: ledger,
        household,
        bookingRestriction: restriction,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
