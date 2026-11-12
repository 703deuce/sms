import type { Appointment, InternalNote, ReminderStep, TimelineEvent } from "@/components/appointments/kimi-ui/detail/types";
import { readPolicySnapshot } from "@/lib/appointments/policy-snapshot";

type ApiAppointment = {
  id: string;
  serviceName: string | null;
  staffName: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  status: string;
  externalId?: string | null;
  inviteeName: string | null;
  inviteeEmail: string | null;
  inviteePhone: string | null;
  reminderStatus: string | null;
  reminderSchedule?: Array<{
    key?: string;
    stepKey?: string;
    label: string;
    channel?: string;
    status: string;
    scheduledFor?: string;
  }>;
  metadata?: {
    timeline?: Array<Record<string, unknown>>;
    notes?: string;
    smsConsent?: boolean;
    smsConsentAt?: string;
    smsConsentText?: string;
    policySnapshot?: Record<string, unknown>;
    bookingAnswers?: Record<string, string>;
    internalNotes?: InternalNote[];
    paymentStatus?: string;
    paymentAmountCents?: number;
    pendingApproval?: boolean;
    reminderOverride?: { suppressed?: boolean };
    extraRecipients?: Array<{ email?: string; phone?: string; name?: string }>;
    remindersSuppressed?: boolean;
    location?: string;
    source?: string;
    bookingSource?: string;
    manageAppointmentUrl?: string;
    manageAppointmentTokenIssuedAt?: string;
  };
  contact?: { id: string } | null;
  serviceLines?: Array<{
    id: string;
    serviceName: string;
    staffId?: string | null;
    startsAt: string;
    endsAt: string;
    displayOrder?: number;
  }>;
  contracts?: Array<{
    id: string;
    status: string;
    templateVersion?: string | null;
    signedAt?: string | null;
    createdAt: string;
  }>;
  contractTemplates?: Array<{ id: string; name: string; version: string }>;
};

export function mapApiAppointment(data: ApiAppointment): Appointment {
  const meta = data.metadata || {};
  const startsAt = data.startsAt;
  const endsAt = data.endsAt || data.startsAt;
  const durationMinutes =
    data.endsAt && data.startsAt
      ? Math.max(1, Math.round((new Date(data.endsAt).getTime() - new Date(data.startsAt).getTime()) / 60000))
      : 30;

  const reminderSchedule: ReminderStep[] = (data.reminderSchedule || []).map((s) => ({
    key: s.key || s.stepKey || s.label,
    label: s.label,
    channel: s.channel || "SMS",
    status: s.status as ReminderStep["status"],
    scheduledFor: s.scheduledFor,
  }));

  const timeline: TimelineEvent[] = (meta.timeline || [])
    .map((t, i) => ({
      id: String(t.id || `t_${i}`),
      at: String(t.at || t.createdAt || new Date().toISOString()),
      type: String(t.type || "event"),
      title: String(t.title || t.label || t.summary || "Updated"),
      detail: t.detail ? String(t.detail) : t.description ? String(t.description) : undefined,
      actor: t.actor ? String(t.actor) : undefined,
    }))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    id: data.id,
    serviceName: data.serviceName || "Appointment",
    staffName: data.staffName || "Unassigned",
    startsAt,
    endsAt,
    timezone: data.timezone || "America/New_York",
    status: data.status,
    inviteeName: data.inviteeName || "",
    inviteeEmail: data.inviteeEmail || "",
    inviteePhone: data.inviteePhone || "",
    location: meta.location || "",
    durationMinutes,
    reminderStatus: data.reminderStatus || "scheduled",
    smsConsent: meta.smsConsent ?? false,
    paymentStatus: meta.paymentStatus || "none",
    paymentAmountCents: meta.paymentAmountCents || 0,
    pendingApproval: meta.pendingApproval ?? false,
    remindersSuppressed: meta.remindersSuppressed ?? meta.reminderOverride?.suppressed ?? false,
    source:
      meta.bookingSource === "staff_created"
        ? "Staff-created"
        : meta.source === "public_booking"
          ? "Public booking"
          : meta.source || "Staff",
    manageAppointmentUrl:
      typeof meta.manageAppointmentUrl === "string" ? meta.manageAppointmentUrl : undefined,
    manageAppointmentTokenIssuedAt:
      typeof meta.manageAppointmentTokenIssuedAt === "string"
        ? meta.manageAppointmentTokenIssuedAt
        : undefined,
    notes: meta.notes || "",
    bookingAnswers: meta.bookingAnswers || {},
    reminderSchedule,
    timeline,
    internalNotes: meta.internalNotes || [],
    extraRecipients: meta.extraRecipients || [],
    contactId: data.contact?.id || "",
    paymentsConnected: true,
    videoProvisioned: true,
    externalId: data.externalId || null,
    policySnapshot: readPolicySnapshot(meta as Record<string, unknown>),
    smsConsentAt: meta.smsConsentAt || null,
    smsConsentText: meta.smsConsentText || null,
    serviceLines: (data.serviceLines || []).map((line) => ({
      id: line.id,
      serviceName: line.serviceName,
      staffId: line.staffId || null,
      startsAt: line.startsAt,
      endsAt: line.endsAt,
      displayOrder: line.displayOrder ?? 0,
    })),
    contracts: (data.contracts || []).map((c) => ({
      id: c.id,
      status: c.status,
      templateVersion: c.templateVersion || null,
      signedAt: c.signedAt || null,
      createdAt: c.createdAt,
    })),
    contractTemplates: data.contractTemplates || [],
  };
}
