import "server-only";

import type {
  BookingInvoice,
  GiftCertificateLedgerEntry,
  HouseholdMember,
  VoiceAppointment,
} from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { listInvoices } from "./booking-invoices";
import { getManageAppointmentIntakeContext } from "./manage-intake";
import { resolveHouseholdForContact } from "./household";
import { listWalletLedger } from "./phase2/client-wallet";
import type { AppointmentMetadata } from "@/lib/appointments/types";

type WalletLedgerRow = Awaited<ReturnType<typeof listWalletLedger>>[number];
type GiftLedgerRow = GiftCertificateLedgerEntry & {
  balance: { balanceCents: number; code: string };
};

export type PortalAppointmentRow = {
  id: string;
  serviceName: string | null;
  startsAt: string;
  endsAt?: string;
  status: string;
  staffName?: string | null;
  locationLabel?: string | null;
  meetingLink?: string | null;
  pendingApproval?: boolean;
  manageAppointmentUrl?: string;
  manageIcsUrl?: string;
  recurringSeriesId?: string | null;
  attendeeCount?: number;
  paymentSummary?: {
    totalPriceCents?: number;
    amountPaidCents?: number;
    balanceDueCents?: number;
    paymentStatus?: string;
  };
};

export type PortalDocumentRow = {
  id: string;
  kind: "intake" | "terms" | "contract";
  title: string;
  appointmentId: string;
  serviceName?: string | null;
  date: string;
  status: string;
  detail?: string;
};

function customerStatusLabel(status: string, meta: AppointmentMetadata): string {
  if (meta.pendingApproval) return "Pending approval";
  if (status === "awaiting_confirmation") return "Pending approval";
  if (status === "confirmed") return "Confirmed";
  if (status === "completed") return "Completed";
  if (status === "canceled" || status === "cancelled") return "Canceled";
  if (status === "no_show") return "No-show";
  return status.replace(/_/g, " ");
}

function maskGiftCode(code?: string | null): string {
  if (!code) return "Gift card";
  const trimmed = code.trim();
  if (trimmed.length <= 4) return "••••";
  return `•••• ${trimmed.slice(-4)}`;
}

export async function buildPortalCustomerPayload(
  workspaceId: string,
  contactId: string,
  workspaceSlug: string | undefined,
) {
  const prisma = getPrisma();

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  });

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, displayName: true, logoUrl: true, slug: true },
  });

  const appointments = await prisma.voiceAppointment.findMany({
    where: { workspaceId, contactId },
    orderBy: { startsAt: "desc" },
    take: 50,
  });

  const appointmentRows: PortalAppointmentRow[] = appointments.map((a: VoiceAppointment) => {
    const meta = (a.metadata || {}) as AppointmentMetadata & {
      pendingApproval?: boolean;
      recurringSeriesId?: string;
    };
    const meetingLink = meta.meetingUrl || meta.joinUrl || meta.eventUrl || null;
    const manageToken = meta.manageAppointmentUrl?.match(/\/manage\/([^/?#]+)/)?.[1];
    return {
      id: a.id,
      serviceName: a.serviceName,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt?.toISOString(),
      status: customerStatusLabel(a.status, meta),
      staffName: a.staffName,
      locationLabel: meta.location || null,
      meetingLink,
      pendingApproval: Boolean(meta.pendingApproval),
      manageAppointmentUrl: meta.manageAppointmentUrl,
      manageIcsUrl: manageToken ? `/api/public/manage/${manageToken}/ics` : undefined,
      recurringSeriesId: meta.recurringSeriesId || null,
      attendeeCount: meta.attendeeCount,
      paymentSummary: {
        totalPriceCents: meta.totalPriceCents,
        amountPaidCents: meta.paymentAmountCents,
        balanceDueCents: meta.balanceDueCents ?? meta.amountDueCents,
        paymentStatus: meta.paymentStatus,
      },
    };
  });

  const now = Date.now();
  const upcomingAppointments = appointmentRows.filter(
    (a) => new Date(a.startsAt).getTime() >= now && !/canceled|cancelled|completed|no-show/i.test(a.status),
  );
  const pastAppointments = appointmentRows.filter(
    (a) => new Date(a.startsAt).getTime() < now || /completed|no-show|canceled|cancelled/i.test(a.status),
  );

  const [walletLedger, giftLedger, invoices, household] = await Promise.all([
    listWalletLedger(workspaceId, contactId, 30),
    prisma.giftCertificateLedgerEntry.findMany({
      where: {
        balance: {
          workspaceId,
          OR: [
            { purchaserContactId: contactId },
            ...(contact?.email ? [{ recipientEmail: contact.email }] : []),
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { balance: true },
    }),
    listInvoices(workspaceId, contactId),
    resolveHouseholdForContact(workspaceId, contactId),
  ]);

  const documents: PortalDocumentRow[] = [];
  for (const appt of appointments.slice(0, 15)) {
    const meta = (appt.metadata || {}) as AppointmentMetadata & {
      pendingApproval?: boolean;
      termsAcceptance?: { acceptedAt?: string; termsVersion?: string };
      contractSnapshot?: { title?: string; signedAt?: string; version?: string };
    };
    if (meta.termsAcceptance?.acceptedAt) {
      documents.push({
        id: `terms-${appt.id}`,
        kind: "terms",
        title: "Terms & Conditions",
        appointmentId: appt.id,
        serviceName: appt.serviceName,
        date: meta.termsAcceptance.acceptedAt,
        status: "Accepted",
        detail: meta.termsAcceptance.termsVersion
          ? `Version ${meta.termsAcceptance.termsVersion}`
          : undefined,
      });
    }
    if (meta.contractSnapshot?.signedAt) {
      documents.push({
        id: `contract-${appt.id}`,
        kind: "contract",
        title: meta.contractSnapshot.title || "Signed agreement",
        appointmentId: appt.id,
        serviceName: appt.serviceName,
        date: meta.contractSnapshot.signedAt,
        status: "Signed",
        detail: meta.contractSnapshot.version,
      });
    }
    try {
      const intakeForms = await getManageAppointmentIntakeContext(workspaceId, appt.id);
      for (const form of intakeForms) {
        if (!form.responseId || !Object.keys(form.answers || {}).length) continue;
        documents.push({
          id: `intake-${form.responseId}`,
          kind: "intake",
          title: form.name,
          appointmentId: appt.id,
          serviceName: appt.serviceName,
          date: appt.startsAt.toISOString(),
          status: "Completed",
        });
      }
    } catch {
      // intake load best-effort per appointment
    }
  }

  const balanceDueAppointments = appointmentRows.filter(
    (a) => (a.paymentSummary?.balanceDueCents || 0) > 0,
  );

  const outstandingInvoices = invoices
    .filter((inv: BookingInvoice) => inv.status === "open" && (inv.balanceDueCents || 0) > 0)
    .map((inv: BookingInvoice) => ({
      id: inv.id,
      status: inv.status,
      totalCents: inv.totalCents,
      balanceDueCents: inv.balanceDueCents,
      createdAt: inv.createdAt.toISOString(),
      dueAt: inv.dueAt?.toISOString() || null,
      currency: inv.currency,
    }));

  return {
    workspace: {
      slug: workspaceSlug || workspace?.slug,
      name: workspace?.displayName || workspace?.name || "Your business",
      logoUrl: workspace?.logoUrl || null,
    },
    contact: contact
      ? {
          id: contact.id,
          firstName: contact.firstName || "",
          lastName: contact.lastName || "",
          email: contact.email || "",
          phone: contact.phone || "",
        }
      : null,
    appointments: appointmentRows,
    upcomingAppointments,
    pastAppointments,
    balanceDueAppointments,
    documents,
    accountCreditHistory: walletLedger.map((e: WalletLedgerRow) => ({
      id: e.id,
      date: e.createdAt.toISOString(),
      activity: e.note || e.kind,
      amountCents: e.amountCents,
      balanceCents: e.balanceAfterCents,
    })),
    giftRedemptionHistory: giftLedger.map((e: GiftLedgerRow) => ({
      id: e.id,
      date: e.createdAt.toISOString(),
      activity: e.note || e.kind,
      amountCents: e.amountCents,
      remainingCents: e.balance?.balanceCents,
      maskedCode: maskGiftCode(e.balance?.code),
    })),
    invoices: invoices.map((inv: BookingInvoice) => ({
      id: inv.id,
      status: inv.status,
      totalCents: inv.totalCents,
      balanceDueCents: inv.balanceDueCents,
      amountPaidCents: inv.depositPaidCents,
      createdAt: inv.createdAt.toISOString(),
      dueAt: inv.dueAt?.toISOString() || null,
      currency: inv.currency,
    })),
    outstandingInvoices,
    household: household
      ? {
          id: household.id,
          name: household.name,
          members: household.members.map((m: HouseholdMember) => ({
            id: m.id,
            contactId: m.contactId,
            displayName: m.displayName,
            role: m.role,
            isSelf: m.contactId === contactId,
          })),
        }
      : null,
  };
}
