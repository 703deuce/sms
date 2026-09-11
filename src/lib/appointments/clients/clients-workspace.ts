import "server-only";

import { visibleContactWhere } from "@/lib/contacts/visible-contacts";
import { getPrisma } from "@/lib/db";
import { getManageAppointmentPaymentSummary } from "@/lib/appointments/service-booking/manage-payments";
import { packageBalanceSummary } from "@/lib/appointments/service-booking/package-lifecycle";
import { getWalletBalance } from "@/lib/appointments/service-booking/phase2/client-wallet";
import { getContactActivityTimeline } from "@/lib/contacts/activity-timeline";
import type { AppointmentMetadata } from "@/lib/appointments/types";

export type ClientDirectoryRow = {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  phone: string;
  nextAppointment: { at: string; label: string } | null;
  lastAppointment: { at: string; label: string } | null;
  bookingCount: number;
  balanceLabel: string;
  accessLabel: string;
  status: "active" | "blocked" | "archived";
  statusLabel: string;
  clientSince: string | null;
};

function displayName(c: { firstName: string | null; lastName: string | null; email: string | null }) {
  const n = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return n || c.email || "Client";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const CANCELLED = new Set(["cancelled", "canceled", "no_show", "noshow"]);

function mapContactStatus(status: string): ClientDirectoryRow["status"] {
  if (status === "BLOCKED") return "blocked";
  if (status === "INVALID") return "archived";
  return "active";
}

export async function buildClientsDirectory(
  workspaceId: string,
  input?: { q?: string; take?: number; skip?: number; status?: string },
) {
  const prisma = getPrisma();
  const take = Math.min(100, Math.max(1, input?.take || 50));
  const skip = Math.max(0, input?.skip || 0);
  const q = input?.q?.trim();

  const where = visibleContactWhere(workspaceId, {
    status: input?.status && input.status !== "all" ? input.status : undefined,
  });

  if (q) {
    Object.assign(where, {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    });
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.contact.count({ where }),
  ]);

  const contactIds = contacts.map((c) => c.id);
  const now = new Date();

  const appointments = contactIds.length
    ? await prisma.voiceAppointment.findMany({
        where: { workspaceId, contactId: { in: contactIds } },
        select: {
          contactId: true,
          startsAt: true,
          serviceName: true,
          status: true,
        },
        orderBy: { startsAt: "desc" },
      })
    : [];

  const apptByContact = new Map<string, typeof appointments>();
  for (const a of appointments) {
    if (!a.contactId) continue;
    const list = apptByContact.get(a.contactId) || [];
    list.push(a);
    apptByContact.set(a.contactId, list);
  }

  const [packages, memberships] = contactIds.length
    ? await Promise.all([
        prisma.packageBalance.findMany({
          where: { workspaceId, contactId: { in: contactIds }, status: "active" },
          select: { contactId: true, remainingCredits: true },
        }),
        prisma.serviceMembershipSubscription.findMany({
          where: { workspaceId, contactId: { in: contactIds }, status: { in: ["active", "past_due"] } },
          select: { contactId: true, status: true },
        }),
      ])
    : [[], []];

  const pkgByContact = new Set(packages.map((p) => p.contactId));
  const memByContact = new Set(memberships.map((m) => m.contactId));

  const directory: ClientDirectoryRow[] = [];
  let upcomingBookings = 0;
  let openBalanceCount = 0;

  for (const c of contacts) {
    const appts = apptByContact.get(c.id) || [];
    const upcoming = appts.filter((a) => a.startsAt > now && !CANCELLED.has(String(a.status).toLowerCase()));
    const past = appts.filter((a) => a.startsAt <= now && !CANCELLED.has(String(a.status).toLowerCase()));
    upcomingBookings += upcoming.length;

    const next = upcoming.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
    const last = past.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0];

    let balanceLabel = "—";
    if (next) {
      try {
        const full = await prisma.voiceAppointment.findFirst({
          where: { workspaceId, contactId: c.id, startsAt: next.startsAt },
          select: { id: true },
        });
        if (full) {
          const pay = await getManageAppointmentPaymentSummary(workspaceId, full.id);
          if (pay.balanceDueCents > 0) {
            balanceLabel = `$${(pay.balanceDueCents / 100).toFixed(0)} due`;
            openBalanceCount += 1;
          } else if (pay.amountPaidCents > 0) balanceLabel = "Paid";
        }
      } catch {
        balanceLabel = "—";
      }
    }

    const hasPkg = pkgByContact.has(c.id);
    const hasMem = memByContact.has(c.id);
    const accessLabel = hasPkg && hasMem ? "Package + Member" : hasMem ? "Member" : hasPkg ? "Package" : "—";

    const st = mapContactStatus(c.status);
    directory.push({
      id: c.id,
      name: displayName(c),
      initials: initials(displayName(c)),
      email: c.email,
      phone: c.phone,
      nextAppointment: next
        ? {
            at: next.startsAt.toISOString(),
            label: `${next.serviceName || "Appointment"}`,
          }
        : null,
      lastAppointment: last
        ? { at: last.startsAt.toISOString(), label: last.serviceName || "Appointment" }
        : null,
      bookingCount: appts.length,
      balanceLabel,
      accessLabel,
      status: st,
      statusLabel: st === "blocked" ? "Blocked" : st === "archived" ? "Archived" : "Active",
      clientSince: c.createdAt.toISOString(),
    });
  }

  const summary = {
    totalClients: total,
    active: directory.filter((d) => d.status === "active").length,
    upcomingBookings,
    openBalances: openBalanceCount,
    needsForms: 0,
  };

  return { directory, summary, total, take, skip };
}

export type ClientDetailPayload = {
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string;
    status: string;
    timezone: string | null;
    customFields: Record<string, unknown>;
    createdAt: string;
  };
  displayName: string;
  bookingStats: {
    upcoming: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  nextAppointment: null | {
    id: string;
    startsAt: string;
    serviceName: string;
    staffName: string | null;
    location: string | null;
    status: string;
    balanceDueCents: number;
    amountPaidCents: number;
  };
  balance: {
    outstandingCents: number;
    walletCreditCents: number;
    lastPayment: { at: string; amountCents: number } | null;
  };
  access: {
    packages: Array<{ id: string; productId: string; remaining: number; expiresAt: string | null; status: string }>;
    memberships: Array<{ id: string; productId: string; status: string; billingInterval: string | null }>;
  };
  appointments: Array<{
    id: string;
    startsAt: string;
    serviceName: string;
    staffName: string | null;
    location: string | null;
    status: string;
    balanceDueCents: number;
  }>;
  forms: Array<{ id: string; formName: string; status: string; submittedAt: string | null; appointmentId?: string }>;
  transactions: Array<{ id: string; at: string; description: string; amountCents: number; status: string }>;
  notes: Array<{ id: string; body: string; at: string; author?: string }>;
  activity: Array<{ at: string; label: string; kind: string }>;
  outstandingActions: Array<{ id: string; label: string; detail: string; href: string }>;
  portalStatus: "not_configured";
  bookingAccess: {
    publicBookingBlocked: boolean;
    restrictionId: string | null;
  };
};

export async function buildClientDetail(workspaceId: string, clientId: string): Promise<ClientDetailPayload | null> {
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: clientId, workspaceId },
  });
  if (!contact) return null;

  const now = new Date();
  const appts = await prisma.voiceAppointment.findMany({
    where: { workspaceId, contactId: clientId },
    orderBy: { startsAt: "desc" },
    take: 100,
  });

  let upcoming = 0;
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  for (const a of appts) {
    const st = String(a.status).toLowerCase();
    if (CANCELLED.has(st)) {
      if (st.includes("no")) noShow += 1;
      else cancelled += 1;
      continue;
    }
    if (a.startsAt > now) upcoming += 1;
    else completed += 1;
  }

  const nextRaw = appts
    .filter((a) => a.startsAt > now && !CANCELLED.has(String(a.status).toLowerCase()))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];

  let nextAppointment: ClientDetailPayload["nextAppointment"] = null;
  let outstandingCents = 0;
  const appointmentRows: ClientDetailPayload["appointments"] = [];

  for (const a of appts.slice(0, 40)) {
    const meta = (a.metadata || {}) as AppointmentMetadata;
    let balanceDueCents = 0;
    try {
      const pay = await getManageAppointmentPaymentSummary(workspaceId, a.id);
      balanceDueCents = pay.balanceDueCents;
      if (balanceDueCents > 0) outstandingCents += balanceDueCents;
    } catch {
      balanceDueCents = 0;
    }
    appointmentRows.push({
      id: a.id,
      startsAt: a.startsAt.toISOString(),
      serviceName: a.serviceName || "Appointment",
      staffName: a.staffName || meta.staffName || null,
      location: meta.location || meta.locationName || null,
      status: String(a.status),
      balanceDueCents,
    });
    if (nextRaw && a.id === nextRaw.id) {
      const pay = await getManageAppointmentPaymentSummary(workspaceId, a.id).catch(() => null);
      nextAppointment = {
        id: a.id,
        startsAt: a.startsAt.toISOString(),
        serviceName: a.serviceName || "Appointment",
        staffName: a.staffName || null,
        location: meta.location || null,
        status: String(a.status),
        balanceDueCents: pay?.balanceDueCents || 0,
        amountPaidCents: pay?.amountPaidCents || 0,
      };
    }
  }

  const wallet = await getWalletBalance(workspaceId, clientId).catch(() => ({
    balanceCents: 0,
    currency: "usd",
    accountId: "",
    status: "active",
  }));

  const apptIds = appts.map((a) => a.id);
  const [packages, memberships, payments, formRows, timeline, intakeForms, bookingRestriction] = await Promise.all([
    prisma.packageBalance.findMany({ where: { workspaceId, contactId: clientId }, orderBy: { createdAt: "desc" } }),
    prisma.serviceMembershipSubscription.findMany({
      where: { workspaceId, contactId: clientId },
      orderBy: { createdAt: "desc" },
    }),
    apptIds.length
      ? prisma.appointmentMerchantPayment.findMany({
          where: { workspaceId, appointmentId: { in: apptIds } },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
    prisma.intakeFormResponse.findMany({
      where: { workspaceId, contactId: clientId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    getContactActivityTimeline(workspaceId, clientId, 25),
    prisma.intakeForm.findMany({ where: { workspaceId }, select: { id: true, name: true } }),
    prisma.clientBookingRestriction.findFirst({
      where: { workspaceId, contactId: clientId, blockPublicBooking: true },
      select: { id: true },
    }),
  ]);
  const formNameById = new Map(intakeForms.map((f) => [f.id, f.name]));

  const lastPayment = payments.find((p) => p.paidAt || p.status === "succeeded" || p.status === "paid");
  const customFields = (contact.customFields || {}) as Record<string, unknown>;
  const notesRaw = (customFields.appointmentsClientNotes || []) as Array<{
    id: string;
    body: string;
    at: string;
    author?: string;
  }>;

  const outstandingActions: ClientDetailPayload["outstandingActions"] = [];
  if (nextAppointment && nextAppointment.balanceDueCents > 0) {
    outstandingActions.push({
      id: "balance",
      label: "Appointment balance due",
      detail: `$${(nextAppointment.balanceDueCents / 100).toFixed(2)}`,
      href: `/appointments/point-of-sale?contactId=${clientId}&appointmentId=${nextAppointment.id}`,
    });
  }

  return {
    contact: {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      status: contact.status,
      timezone: contact.timezone,
      customFields,
      createdAt: contact.createdAt.toISOString(),
    },
    displayName: displayName(contact),
    bookingStats: { upcoming, completed, cancelled, noShow },
    nextAppointment,
    balance: {
      outstandingCents,
      walletCreditCents: wallet.balanceCents,
      lastPayment: lastPayment
        ? {
            at: (lastPayment.paidAt || lastPayment.createdAt).toISOString(),
            amountCents: lastPayment.amountPaidCents,
          }
        : null,
    },
    access: {
      packages: packages.map((p) => ({
        id: p.id,
        productId: p.productId,
        remaining: packageBalanceSummary((p.remainingCredits || {}) as Record<string, number>).totalRemaining,
        expiresAt: p.expiresAt?.toISOString() || null,
        status: p.status,
      })),
      memberships: memberships.map((m) => ({
        id: m.id,
        productId: m.productId,
        status: m.status,
        billingInterval: m.billingInterval,
      })),
    },
    appointments: appointmentRows,
    forms: formRows.map((f) => ({
      id: f.id,
      formName: formNameById.get(f.formId) || "Form",
      status: "submitted",
      submittedAt: f.createdAt.toISOString(),
      appointmentId: f.appointmentId || undefined,
    })),
    transactions: payments.map((p) => ({
      id: p.id,
      at: (p.paidAt || p.createdAt).toISOString(),
      description: `Appointment payment`,
      amountCents: p.amountPaidCents,
      status: p.status,
    })),
    notes: notesRaw,
    activity: timeline.map((t) => ({ at: t.at, label: t.summary, kind: t.kind })),
    outstandingActions,
    portalStatus: "not_configured",
    bookingAccess: {
      publicBookingBlocked: Boolean(bookingRestriction),
      restrictionId: bookingRestriction?.id || null,
    },
  };
}
