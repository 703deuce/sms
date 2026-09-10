"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar, Clock, CreditCard, MapPin, MessageSquare, Phone, Mail,
  ShieldCheck, StickyNote, User, Users, X, AlertTriangle, Plus, Info,
  Lock, FileQuestion, RefreshCcw,
} from "lucide-react";
import type { Appointment } from "../types";
import { mapApiAppointment } from "@/features/appointments/kimi/detail/map-detail";
import { Button, Card, StatusBadge, fmtPhone, money, fmtDateTime } from "./ui";
import { AppointmentHeader } from "./AppointmentHeader";
import { ReminderSchedule } from "./ReminderSchedule";
import { ActivityTimeline } from "./ActivityTimeline";
import { RescheduleModal } from "./RescheduleModal";
import { CancelModal } from "./CancelModal";
import { RefundModal } from "./RefundModal";
import { VideoMeetingPanel } from "./VideoMeetingPanel";
import { NotetakerPanel } from "./NotetakerPanel";

const TERMINAL = new Set(["canceled", "completed", "no_show"]);
const TERMINAL_COPY: Record<string, { title: string; text: string }> = {
  canceled: {
    title: "This appointment was canceled",
    text: "Pending reminders were stopped and the customer was notified. The record is read-only — booking activity is preserved in the timeline below.",
  },
  completed: {
    title: "This appointment is complete",
    text: "The appointment took place and was marked complete. The record is read-only.",
  },
  no_show: {
    title: "Customer was a no-show",
    text: "The customer did not arrive. The record is read-only. No-show follow-up can be configured under No-Show Recovery.",
  },
};

export function AppointmentDetail({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [acting, setActing] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleSlots, setRescheduleSlots] = useState<Array<{ startsAt: string; endsAt?: string }>>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [internalNote, setInternalNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [extraEmail, setExtraEmail] = useState("");
  const [extraName, setExtraName] = useState("");
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);

  function customerInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
  }

  async function fetchAppt() {
    setLoading(true);
    setLoadError(false);
    setNotFound(false);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`);
      if (res.status === 404) {
        setNotFound(true);
        setAppt(null);
        return;
      }
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      setAppt(mapApiAppointment(json.data));
    } catch {
      setLoadError(true);
      setAppt(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAppt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  async function patch(update: Record<string, unknown>, toastMsg: string) {
    setActing(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!res.ok) throw new Error("patch failed");
      await fetchAppt();
      showToast(toastMsg);
    } catch {
      showToast("Something went wrong. Try again.");
    } finally {
      setActing(false);
    }
  }

  async function openReschedule() {
    if (!appt?.serviceName) return;
    setRescheduleOpen(true);
    setLoadingRescheduleSlots(true);
    setRescheduleSlots([]);
    try {
      const res = await fetch(
        `/api/appointments/availability?serviceName=${encodeURIComponent(appt.serviceName)}&daysAhead=14`,
      );
      const json = await res.json();
      setRescheduleSlots(json.data?.slots || []);
    } finally {
      setLoadingRescheduleSlots(false);
    }
  }

  async function saveReschedule(startsAt: string) {
    setRescheduleOpen(false);
    setActing(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt }),
      });
      if (!res.ok) throw new Error("reschedule failed");
      await fetchAppt();
      showToast("Appointment rescheduled. Customer notified.");
    } catch {
      showToast("Could not reschedule. Try again.");
    } finally {
      setActing(false);
    }
  }

  async function addNote() {
    if (!internalNote.trim()) return;
    setAddingNote(true);
    try {
      await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNote: internalNote.trim() }),
      });
      setInternalNote("");
      await fetchAppt();
      showToast("Note added.");
    } finally {
      setAddingNote(false);
    }
  }

  async function addExtraRecipient() {
    if (!extraEmail.trim() && !appt) return;
    const existing = appt?.extraRecipients || [];
    await patch(
      {
        extraRecipients: [
          ...existing,
          { name: extraName.trim() || undefined, email: extraEmail.trim() || undefined },
        ],
      },
      "Additional recipient added.",
    );
    setExtraEmail("");
    setExtraName("");
  }

  function removeExtraRecipient(i: number) {
    if (!appt) return;
    void patch(
      { extraRecipients: appt.extraRecipients.filter((_, idx) => idx !== i) },
      "Recipient removed.",
    );
  }

  async function refundPayment(input: {
    amountCents: number;
    refundToAccountCredit: boolean;
    reason: string;
  }) {
    setActing(true);
    try {
      const res = await fetch("/api/appointments/service-booking/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          amountCents: input.amountCents,
          refundToAccountCredit: input.refundToAccountCredit,
          contactId: appt?.contactId,
          reason: input.reason,
        }),
      });
      if (!res.ok) throw new Error("refund failed");
      await fetchAppt();
      showToast("Refund issued.");
    } finally {
      setActing(false);
    }
  }

  async function issueContract(templateId: string) {
    if (!appt?.contactId) {
      showToast("Link a contact before issuing a contract.");
      return;
    }
    setActing(true);
    try {
      const res = await fetch("/api/appointments/service-booking/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue",
          templateId,
          appointmentId: appt.id,
          contactId: appt.contactId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "issue failed");
      await fetchAppt();
      showToast("Contract issued for signature.");
    } catch {
      showToast("Could not issue contract.");
    } finally {
      setActing(false);
    }
  }

  async function loadSlotDiagnostic() {
    if (!appt?.serviceName || !appt.startsAt) return;
    const res = await fetch(
      `/api/appointments/diagnostics/slots?serviceName=${encodeURIComponent(appt.serviceName)}&startsAt=${encodeURIComponent(appt.startsAt)}&explain=true`,
    );
    if (!res.ok) return;
    const json = await res.json();
    setDiagnostic(json.data?.explanation || null);
  }

  /* ---------- Loading ---------- */
  if (loading) {
    return (
      <div className="stack" aria-busy="true" aria-label="Loading appointment">
        <div className="skeleton" style={{ width: 120, height: 18 }} />
        <div className="skeleton" style={{ width: 420, height: 46 }} />
        <div className="detail-grid">
          <div className="stack">
            <div className="skeleton" style={{ height: 260 }} />
            <div className="skeleton" style={{ height: 320 }} />
          </div>
          <div className="stack">
            <div className="skeleton" style={{ height: 220 }} />
            <div className="skeleton" style={{ height: 180 }} />
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Error state ---------- */
  if (loadError) {
    return (
      <div className="state-panel">
        <div className="state-icon"><AlertTriangle size={22} /></div>
        <h2 className="state-title">This appointment couldn’t be loaded</h2>
        <p className="state-text">
          Something went wrong while fetching the appointment. Your data is safe — try again.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Button size="sm" onClick={fetchAppt}>
            <RefreshCcw size={13} /> Retry
          </Button>
          <Button size="sm" variant="outline" onClick={() => showToast("Back to Appointments list")}>
            Back to Appointments
          </Button>
        </div>
        {toast && <div className="toast" role="status"><ShieldCheck size={15} /> {toast}</div>}
      </div>
    );
  }

  /* ---------- Not found ---------- */
  if (notFound || !appt) {
    return (
      <div className="state-panel">
        <div className="state-icon"><FileQuestion size={22} /></div>
        <h2 className="state-title">Appointment not found</h2>
        <p className="state-text">
          This appointment doesn’t exist or may have been removed. Check the link, or return to
          the appointments list to find what you need.
        </p>
        <Button size="sm" onClick={() => showToast("Back to Appointments list")}>
          Back to Appointments
        </Button>
        {toast && <div className="toast" role="status"><ShieldCheck size={15} /> {toast}</div>}
      </div>
    );
  }

  const isTerminal = TERMINAL.has(appt.status);
  const isPendingApproval = appt.pendingApproval;
  const terminal = TERMINAL_COPY[appt.status];

  return (
    <div>
      <AppointmentHeader
        appt={appt}
        acting={acting}
        onBack={() => router.push("/appointments")}
        onMessage={() => {
          if (appt.contactId) router.push(`/conversations?contact=${appt.contactId}`);
          else showToast("Opening conversation…");
        }}
        onReschedule={openReschedule}
        onConfirm={() => patch({ status: "confirmed" }, "Appointment confirmed.")}
        onComplete={() => patch({ status: "completed" }, "Marked complete.")}
        onNoShow={() => patch({ status: "no_show" }, "Marked as no-show.")}
        onCancel={() => setCancelOpen(true)}
      />

      {isPendingApproval ? (
        <div className="banner" style={{ marginBottom: 18 }}>
          <AlertTriangle size={17} className="banner-icon" />
          <div className="banner-body">
            <div className="banner-title">Booking request needs your approval</div>
            <div className="banner-text">This booking type requires approval. The time is held but not confirmed. Approve to confirm it, or reject to release the slot.</div>
          </div>
          <Button size="sm" onClick={() => patch({ pendingApproval: false, status: "confirmed" }, "Booking approved.")}>Approve</Button>
          <Button size="sm" variant="outline" onClick={() => patch({ pendingApproval: false, action: "cancel", status: "canceled" }, "Booking rejected.")}>Reject</Button>
        </div>
      ) : null}

      {isTerminal && terminal ? (
        <div className="banner banner-neutral" style={{ marginBottom: 18 }}>
          <Lock size={17} className="banner-icon" style={{ color: "#667085" }} />
          <div className="banner-body">
            <div className="banner-title" style={{ color: "#344054" }}>{terminal.title}</div>
            <div className="banner-text" style={{ color: "#667085" }}>{terminal.text}</div>
          </div>
        </div>
      ) : null}

      <div className="detail-grid">
        {/* LEFT — primary column */}
        <div className="stack">
          <Card title="Appointment details">
            <div className="info-list">
              <div className="info-row">
                <span className="info-label"><Calendar size={13} /> Date &amp; time</span>
                <span className="info-value">
                  {fmtDateTime(appt.startsAt, appt.timezone)} – {fmtDateTime(appt.endsAt, appt.timezone).split(", ").pop()}
                  <span className="sub">{appt.timezone} · {appt.durationMinutes} minutes</span>
                </span>
              </div>
              <div className="info-row">
                <span className="info-label"><Users size={13} /> Staff</span>
                <span className="info-value">{appt.staffName}</span>
              </div>
              {appt.serviceLines && appt.serviceLines.length > 0 ? (
                <div className="info-row">
                  <span className="info-label"><Calendar size={13} /> Service lines</span>
                  <span className="info-value">
                    <ol style={{ margin: 0, paddingLeft: 18 }}>
                      {appt.serviceLines.map((line) => (
                        <li key={line.id}>
                          {line.serviceName}
                          <span className="sub">
                            {fmtDateTime(line.startsAt, appt.timezone)} –{" "}
                            {fmtDateTime(line.endsAt, appt.timezone).split(", ").pop()}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </span>
                </div>
              ) : null}
              <div className="info-row">
                <span className="info-label"><MapPin size={13} /> Location</span>
                <span className="info-value">{appt.location}</span>
              </div>
              <div className="info-row">
                <span className="info-label"><Clock size={13} /> Source</span>
                <span className="info-value">{appt.source}</span>
              </div>
              <div className="info-row">
                <span className="info-label"><RefreshCcw size={13} /> Calendar sync</span>
                <span className="info-value">
                  {appt.externalId ? (
                    <>
                      Synced to connected calendar
                      <span className="sub">External event linked</span>
                    </>
                  ) : (
                    <>
                      Not synced
                      <span className="sub">No external calendar event on file. Check Integrations → Calendars if sync was expected.</span>
                    </>
                  )}
                </span>
              </div>
              {appt.policySnapshot ? (
                <div className="info-row">
                  <span className="info-label"><FileQuestion size={13} /> Policy at booking</span>
                  <span className="info-value">
                    {appt.policySnapshot.cancellation?.allowed === "until_hours_before"
                      ? `Cancel until ${appt.policySnapshot.cancellation.cutoffHours || 0}h before`
                      : appt.policySnapshot.cancellation?.allowed === "disabled"
                        ? "No online cancellation"
                        : "Cancel anytime"}
                    {" · "}
                    {appt.policySnapshot.reschedule?.allowed === "until_hours_before"
                      ? `Reschedule until ${appt.policySnapshot.reschedule.cutoffHours || 0}h before`
                      : appt.policySnapshot.reschedule?.allowed === "disabled"
                        ? "No online reschedule"
                        : "Reschedule anytime"}
                    {(appt.policySnapshot.extendedCancellation?.lateFeeCents || 0) > 0 ? (
                      <span className="sub">
                        Late cancel / no-show fee: {money(appt.policySnapshot.extendedCancellation!.lateFeeCents!)}
                      </span>
                    ) : null}
                    {appt.policySnapshot.capturedAt ? (
                      <span className="sub">Snapshot · {fmtDateTime(appt.policySnapshot.capturedAt, appt.timezone)}</span>
                    ) : null}
                  </span>
                </div>
              ) : null}
              {appt.enrichment?.servicePhases?.length ? (
                <div className="info-row">
                  <span className="info-label"><Clock size={13} /> Service schedule</span>
                  <span className="info-value">
                    <ol style={{ margin: 0, paddingLeft: 18 }}>
                      {appt.enrichment.servicePhases.map((phase) => (
                        <li key={`${phase.name}-${phase.startsAt}`}>
                          {phase.name}
                          <span className="sub">
                            {fmtDateTime(phase.startsAt, appt.timezone)} – {fmtDateTime(phase.endsAt, appt.timezone).split(", ").pop()}
                            {phase.staffRequired ? " · Staff needed" : " · Staff released"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </span>
                </div>
              ) : null}
              {appt.enrichment?.roomsEquipment?.length ? (
                <div className="info-row">
                  <span className="info-label"><MapPin size={13} /> Rooms &amp; Equipment</span>
                  <span className="info-value">
                    {appt.enrichment.roomsEquipment.map((r) => r.label).join(" · ")}
                  </span>
                </div>
              ) : null}
              {appt.enrichment?.addOns?.length ? (
                <div className="info-row">
                  <span className="info-label"><Plus size={13} /> Add-ons</span>
                  <span className="info-value">
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {appt.enrichment.addOns.map((a) => (
                        <li key={a.name}>
                          {a.name}
                          {a.priceCents ? <span className="sub"> +{money(a.priceCents)}</span> : null}
                          {a.durationMinutes ? <span className="sub"> +{a.durationMinutes} min</span> : null}
                        </li>
                      ))}
                    </ul>
                  </span>
                </div>
              ) : null}
              <div className="info-row">
                <span className="info-label"><CreditCard size={13} /> Payment</span>
                <span className="info-value" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <StatusBadge status={appt.paymentStatus} />
                  <span>{money(appt.enrichment?.financialSummary?.paidCents ?? appt.paymentAmountCents)}</span>
                  {(appt.enrichment?.financialSummary?.balanceCents || 0) > 0 ? (
                    <span className="sub">Balance {money(appt.enrichment!.financialSummary!.balanceCents!)}</span>
                  ) : null}
                  {(appt.enrichment?.financialSummary?.refundedCents || appt.refundAmountCents || 0) > 0 ? (
                    <span className="sub">Refunded {money(appt.enrichment?.financialSummary?.refundedCents ?? appt.refundAmountCents ?? 0)}</span>
                  ) : null}
                  {appt.paymentStatus === "paid" && appt.paymentsConnected && !isTerminal && (
                    <Button size="sm" variant="ghost" disabled={acting} onClick={() => setRefundOpen(true)}>Refund</Button>
                  )}
                  {appt.paymentStatus === "paid" && !appt.paymentsConnected && (
                    <span className="sub" style={{ display: "inline" }}>
                      Payments provider disconnected — refunds unavailable. Reconnect under Integrations → Payments.
                    </span>
                  )}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label"><ShieldCheck size={13} /> SMS consent</span>
                <span className="info-value">
                  {appt.smsConsent ? (
                    <>
                      Captured — appointment reminder texts
                      {appt.smsConsentAt ? (
                        <span className="sub">
                          {fmtDateTime(appt.smsConsentAt, appt.timezone)}
                          {appt.smsConsentText ? ` · ${appt.smsConsentText.slice(0, 80)}${appt.smsConsentText.length > 80 ? "…" : ""}` : ""}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      Not captured
                      <span className="sub">No consent evidence on file — SMS reminders are unavailable for this appointment.</span>
                    </>
                  )}
                </span>
              </div>
            </div>
            {appt.enrichment?.entitlementPayment ? (
              <>
                <hr className="section-divider" />
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Payments &amp; access
                </div>
                <div className="info-list">
                  {appt.enrichment.entitlementPayment.packageName ? (
                    <div className="info-row">
                      <span className="info-label">Paid with</span>
                      <span className="info-value">
                        {appt.enrichment.entitlementPayment.packageName}
                        {appt.enrichment.entitlementPayment.creditsUsed ? (
                          <span className="sub">Credits used: {appt.enrichment.entitlementPayment.creditsUsed}</span>
                        ) : null}
                        {appt.enrichment.entitlementPayment.creditsRemaining != null ? (
                          <span className="sub">Remaining after booking: {appt.enrichment.entitlementPayment.creditsRemaining}</span>
                        ) : null}
                      </span>
                    </div>
                  ) : null}
                  {appt.enrichment.entitlementPayment.membershipName ? (
                    <div className="info-row">
                      <span className="info-label">Membership</span>
                      <span className="info-value">{appt.enrichment.entitlementPayment.membershipName}</span>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {appt.enrichment?.intakeResponses?.length ? (
              <>
                <hr className="section-divider" />
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Intake form
                </div>
                {appt.enrichment.intakeResponses.map((form) => (
                  <div key={form.formId} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{form.formName}</div>
                    {form.attachments.map((file) => (
                      <div key={file.fieldId} className="sub">
                        {file.url ? (
                          <a href={file.url} target="_blank" rel="noreferrer">{file.filename}</a>
                        ) : (
                          file.filename
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            ) : null}

            {Object.keys(appt.bookingAnswers).length > 0 && (
              <>
                <hr className="section-divider" />
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Booking answers
                </div>
                <div className="info-list">
                  {Object.entries(appt.bookingAnswers).map(([q, a]) => (
                    <div className="info-row" key={q}>
                      <span className="info-label">{q}</span>
                      <span className="info-value">{a}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {appt.notes && (
              <>
                <hr className="section-divider" />
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Customer notes
                </div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>{appt.notes}</p>
              </>
            )}
            <hr className="section-divider" />
            <button
              className="back-link"
              style={{ fontSize: 12.5 }}
              onClick={loadSlotDiagnostic}
            >
              <Info size={13} /> Why was this time available?
            </button>
            {diagnostic ? <p className="muted small" style={{ margin: "8px 0 0" }}>{diagnostic}</p> : null}
          </Card>

          {(appt.policySnapshot || appt.enrichment?.termsAcceptance) ? (
            <Card title="Documents &amp; policies">
              {appt.policySnapshot ? (
                <div className="info-list">
                  <div className="info-row">
                    <span className="info-label">Cancellation policy</span>
                    <span className="info-value">
                      {appt.policySnapshot.cancellation?.policyText ||
                        (appt.policySnapshot.cancellation?.allowed === "until_hours_before"
                          ? `Cancel at least ${appt.policySnapshot.cancellation.cutoffHours || 0} hours before`
                          : "Policy at booking")}
                      {appt.policySnapshot.capturedAt ? (
                        <span className="sub">Accepted/booked: {fmtDateTime(appt.policySnapshot.capturedAt, appt.timezone)}</span>
                      ) : null}
                    </span>
                  </div>
                </div>
              ) : null}
              {appt.enrichment?.termsAcceptance?.accepted ? (
                <p className="muted small" style={{ margin: "8px 0 0" }}>
                  Terms &amp; Conditions v{appt.enrichment.termsAcceptance.termsVersion || "—"}
                  {appt.enrichment.termsAcceptance.acceptedAt
                    ? ` · Accepted ${fmtDateTime(appt.enrichment.termsAcceptance.acceptedAt, appt.timezone)}`
                    : ""}
                </p>
              ) : null}
            </Card>
          ) : null}

          {appt.enrichment?.recurringSeries ? (
            <Card title="Recurring series">
              <p style={{ margin: 0, fontSize: 13.5 }}>
                {appt.enrichment.recurringSeries.frequencyLabel}
                {appt.enrichment.recurringSeries.rangeLabel ? ` · ${appt.enrichment.recurringSeries.rangeLabel}` : ""}
              </p>
              <p className="muted small" style={{ margin: "6px 0 0" }}>
                Appointment {appt.enrichment.recurringSeries.occurrenceIndex}
                {appt.enrichment.recurringSeries.totalOccurrences
                  ? ` of ${appt.enrichment.recurringSeries.totalOccurrences}`
                  : ""}
              </p>
            </Card>
          ) : null}

          {(appt.contracts?.length || appt.contractTemplates?.length) ? (
            <Card title="Contracts">
              {appt.contracts && appt.contracts.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
                  {appt.contracts.map((c) => (
                    <li key={c.id}>
                      {c.status === "signed" ? "Signed" : c.status === "unsigned" ? "Awaiting signature" : c.status}
                      {c.templateVersion ? ` · ${c.templateVersion}` : ""}
                      {c.signedAt ? (
                        <span className="sub"> · {fmtDateTime(c.signedAt, appt.timezone)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small" style={{ margin: 0 }}>No contract issued yet.</p>
              )}
              {!isTerminal && appt.contractTemplates && appt.contractTemplates.length > 0 ? (
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {appt.contractTemplates.map((t) => (
                    <Button
                      key={t.id}
                      size="sm"
                      variant="outline"
                      disabled={acting}
                      onClick={() => void issueContract(t.id)}
                    >
                      Issue {t.name}
                    </Button>
                  ))}
                </div>
              ) : null}
            </Card>
          ) : null}

          <ReminderSchedule
            steps={appt.reminderSchedule}
            suppressed={appt.remindersSuppressed}
            consentMissing={!appt.smsConsent}
            readOnly={isTerminal}
            onToggleSuppressed={(v) =>
              patch({ remindersSuppressed: v }, v ? "Reminders suppressed for this appointment." : "Reminders restored for this appointment.")
            }
          />

          <Card title={<><Users size={15} className="muted" /> Additional recipients</>} sub="Also receive confirmation and reminder messages">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {appt.extraRecipients.length === 0 && (
                <span className="muted small">No additional recipients.</span>
              )}
              {appt.extraRecipients.map((r, i) => (
                <span className="chip" key={i}>
                  {r.name ? `${r.name} — ` : ""}{r.email || r.phone}
                  {!isTerminal && (
                    <button onClick={() => removeExtraRecipient(i)} aria-label={`Remove ${r.email || r.phone}`}>
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!isTerminal && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                <input className="input" placeholder="Name (optional)" value={extraName} onChange={(e) => setExtraName(e.target.value)} aria-label="Recipient name" />
                <input className="input" placeholder="Email or phone" value={extraEmail} onChange={(e) => setExtraEmail(e.target.value)} aria-label="Recipient email or phone" />
                <Button variant="outline" size="sm" style={{ height: 36 }} onClick={addExtraRecipient} disabled={!extraEmail.trim()}>
                  <Plus size={13} /> Add
                </Button>
              </div>
            )}
          </Card>

          <ActivityTimeline events={appt.timeline} />
        </div>

        {/* RIGHT — sidebar column */}
        <div className="stack">
          <Card title={<><User size={15} className="muted" /> Customer</>}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
              <span className="avatar" style={{ width: 36, height: 36, fontSize: 13 }} aria-hidden>
                {customerInitials(appt.inviteeName)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{appt.inviteeName}</div>
                <a
                  href={appt.contactId ? `/contacts/${appt.contactId}` : "#"}
                  onClick={(e) => {
                    if (!appt.contactId) {
                      e.preventDefault();
                      showToast("No contact record linked.");
                    }
                  }}
                  style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}
                >
                  View contact record
                </a>
              </div>
            </div>
            <div className="info-list">
              <div className="info-row" style={{ gridTemplateColumns: "24px 1fr" }}>
                <span className="info-label"><Phone size={13} /></span>
                <span className="info-value">{fmtPhone(appt.inviteePhone)}</span>
              </div>
              <div className="info-row" style={{ gridTemplateColumns: "24px 1fr" }}>
                <span className="info-label"><Mail size={13} /></span>
                <span className="info-value" style={{ wordBreak: "break-all" }}>{appt.inviteeEmail}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" style={{ width: "100%", marginTop: 8 }} onClick={() => showToast("Opening conversation…")}>
              <MessageSquare size={13} /> Message customer
            </Button>
          </Card>

          <VideoMeetingPanel
            appointmentId={appointmentId}
            provisioned={appt.videoProvisioned}
            onCopied={() => showToast("Guest link copied.")}
          />
          <NotetakerPanel appointmentId={appointmentId} />

          <Card title={<><StickyNote size={15} className="muted" /> Internal notes</>} sub="Only visible to your team">
            <div className="stack" style={{ gap: 10 }}>
              {appt.internalNotes.length === 0 && (
                <p className="muted small" style={{ margin: 0 }}>No notes yet.</p>
              )}
              {appt.internalNotes.map((n) => (
                <div key={n.id} style={{ background: "#fafbfc", border: "1px solid var(--border-subtle)", borderRadius: 9, padding: "10px 12px" }}>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{n.body}</div>
                  <div className="muted small" style={{ marginTop: 5 }}>{n.authorName} · {fmtDateTime(n.at)}</div>
                </div>
              ))}
              {!isTerminal && (
                <>
                  <textarea
                    className="textarea"
                    placeholder="Add a note for your team…"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    aria-label="Internal note"
                  />
                  <Button variant="outline" size="sm" style={{ alignSelf: "flex-start" }} onClick={addNote} disabled={!internalNote.trim() || addingNote}>
                    {addingNote ? "Adding…" : "Add note"}
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {rescheduleOpen && !isTerminal && (
        <RescheduleModal
          timezone={appt.timezone}
          slots={rescheduleSlots}
          loading={loadingRescheduleSlots}
          onClose={() => setRescheduleOpen(false)}
          onSave={saveReschedule}
        />
      )}

      {refundOpen && !isTerminal && (
        <RefundModal
          open={refundOpen}
          amountPaidCents={appt.enrichment?.financialSummary?.paidCents ?? appt.paymentAmountCents}
          amountRefundedCents={appt.enrichment?.financialSummary?.refundedCents ?? appt.refundAmountCents ?? 0}
          supportsAccountCredit={Boolean(appt.contactId)}
          onClose={() => setRefundOpen(false)}
          onConfirm={refundPayment}
        />
      )}

      {cancelOpen && (
        <CancelModal
          appt={appt}
          onClose={() => setCancelOpen(false)}
          onConfirm={() => {
            setCancelOpen(false);
            patch({ action: "cancel", status: "canceled" }, "Appointment canceled. Reminders stopped and customer notified.");
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <ShieldCheck size={15} /> {toast}
        </div>
      )}
    </div>
  );
}
