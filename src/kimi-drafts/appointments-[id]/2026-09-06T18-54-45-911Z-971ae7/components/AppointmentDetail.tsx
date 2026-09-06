"use client";

import { useEffect, useState } from "react";
import {
  Calendar, Clock, CreditCard, MapPin, MessageSquare, Phone, Mail,
  ShieldCheck, StickyNote, User, Users, X, AlertTriangle, Plus, Info,
} from "lucide-react";
import { appointment as mockAppt } from "../mock-data";
import { Button, Card, StatusBadge, fmtPhone, money, fmtDateTime } from "./ui";
import { AppointmentHeader } from "./AppointmentHeader";
import { ReminderSchedule } from "./ReminderSchedule";
import { ActivityTimeline } from "./ActivityTimeline";
import { RescheduleModal } from "./RescheduleModal";
import { VideoMeetingPanel } from "./VideoMeetingPanel";
import { NotetakerPanel } from "./NotetakerPanel";

export function AppointmentDetail({ appointmentId }: { appointmentId: string }) {
  const [loading, setLoading] = useState(true);
  const [appt, setAppt] = useState(mockAppt);
  const [acting, setActing] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [internalNote, setInternalNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [extraEmail, setExtraEmail] = useState("");
  const [extraName, setExtraName] = useState("");
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, [appointmentId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function patch(update: Record<string, unknown>, toastMsg: string) {
    setActing(true);
    setTimeout(() => {
      setAppt((a) => {
        const next = { ...a, ...update } as typeof a;
        next.timeline = [
          {
            id: `t_${Date.now()}`,
            at: new Date().toISOString(),
            type: String(update.status || update.action || "updated"),
            title:
              update.status === "confirmed" ? "Appointment confirmed"
              : update.status === "completed" ? "Marked complete"
              : update.status === "no_show" ? "Marked as no-show"
              : update.action === "cancel" ? "Appointment canceled — pending reminders stopped"
              : "Appointment updated",
            detail: "By you, just now",
          },
          ...a.timeline,
        ];
        return next;
      });
      setActing(false);
      showToast(toastMsg);
    }, 550);
  }

  function saveReschedule(startsAt: string) {
    setRescheduleOpen(false);
    setAppt((a) => ({
      ...a,
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + a.durationMinutes * 60000).toISOString(),
      status: "scheduled",
      timeline: [
        {
          id: `t_${Date.now()}`,
          at: new Date().toISOString(),
          type: "rescheduled",
          title: "Appointment rescheduled",
          detail: "Old reminder jobs canceled and recalculated. Customer notified.",
        },
        ...a.timeline,
      ],
    }));
    showToast("Appointment rescheduled. Customer notified.");
  }

  function addNote() {
    if (!internalNote.trim()) return;
    setAddingNote(true);
    setTimeout(() => {
      setAppt((a) => ({
        ...a,
        internalNotes: [
          { id: `n_${Date.now()}`, at: new Date().toISOString(), authorName: "You", body: internalNote.trim() },
          ...a.internalNotes,
        ],
      }));
      setInternalNote("");
      setAddingNote(false);
      showToast("Note added.");
    }, 400);
  }

  function addExtraRecipient() {
    if (!extraEmail.trim()) return;
    setAppt((a) => ({
      ...a,
      extraRecipients: [...a.extraRecipients, { name: extraName.trim() || undefined, email: extraEmail.trim() }],
    }));
    setExtraEmail("");
    setExtraName("");
    showToast("Additional recipient added.");
  }

  function removeExtraRecipient(i: number) {
    setAppt((a) => ({ ...a, extraRecipients: a.extraRecipients.filter((_, idx) => idx !== i) }));
  }

  function refundPayment() {
    setActing(true);
    setTimeout(() => {
      setAppt((a) => ({
        ...a,
        paymentStatus: "refunded",
        timeline: [
          { id: `t_${Date.now()}`, at: new Date().toISOString(), type: "payment", title: `Deposit refunded — ${money(a.paymentAmountCents)}`, detail: "Refund issued to original payment method." },
          ...a.timeline,
        ],
      }));
      setActing(false);
      showToast(`Refund of ${money(appt.paymentAmountCents)} issued.`);
    }, 600);
  }

  function loadSlotDiagnostic() {
    setDiagnostic("The current time is held for this appointment. Nearby times remain bookable per Standard Hours with a 15-minute buffer.");
  }

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

  const isPendingApproval = appt.pendingApproval;

  return (
    <div>
      <AppointmentHeader
        appt={appt}
        acting={acting}
        onBack={() => showToast("Back to Appointments list")}
        onMessage={() => showToast("Opening conversation with Sarah Johnson…")}
        onReschedule={() => setRescheduleOpen(true)}
        onConfirm={() => patch({ status: "confirmed" }, "Appointment confirmed.")}
        onComplete={() => patch({ status: "completed" }, "Marked complete.")}
        onNoShow={() => patch({ status: "no_show" }, "Marked as no-show.")}
        onCancel={() => patch({ action: "cancel", status: "canceled" }, "Appointment canceled. Reminders stopped.")}
      />

      {isPendingApproval ? (
        <div className="banner" style={{ marginBottom: 18 }}>
          <AlertTriangle size={17} className="banner-icon" />
          <div className="banner-body">
            <div className="banner-title">Booking request needs your approval</div>
            <div className="banner-text">This time is held but not confirmed. Approve to confirm it, or reject to release the slot.</div>
          </div>
          <Button size="sm" onClick={() => patch({ pendingApproval: false, status: "confirmed" }, "Booking approved.")}>Approve</Button>
          <Button size="sm" variant="outline" onClick={() => patch({ pendingApproval: false, action: "cancel", status: "canceled" }, "Booking rejected.")}>Reject</Button>
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
                  <span className="sub">Eastern Time (America/New_York) · {appt.durationMinutes} minutes</span>
                </span>
              </div>
              <div className="info-row">
                <span className="info-label"><Users size={13} /> Staff</span>
                <span className="info-value">{appt.staffName}</span>
              </div>
              <div className="info-row">
                <span className="info-label"><MapPin size={13} /> Location</span>
                <span className="info-value">{appt.location}</span>
              </div>
              <div className="info-row">
                <span className="info-label"><Clock size={13} /> Source</span>
                <span className="info-value">{appt.source}</span>
              </div>
              <div className="info-row">
                <span className="info-label"><CreditCard size={13} /> Payment</span>
                <span className="info-value" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <StatusBadge status={appt.paymentStatus} />
                  <span>{money(appt.paymentAmountCents)} deposit</span>
                  {appt.paymentStatus === "paid" && (
                    <Button size="sm" variant="ghost" disabled={acting} onClick={refundPayment}>Refund</Button>
                  )}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label"><ShieldCheck size={13} /> SMS consent</span>
                <span className="info-value">
                  {appt.smsConsent ? (
                    <>
                      Captured — appointment reminder texts
                      <span className="sub">Booking page checkbox · Sep 7, 2026 at 10:03 AM</span>
                    </>
                  ) : (
                    "Not captured"
                  )}
                </span>
              </div>
            </div>
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

          <ReminderSchedule
            steps={appt.reminderSchedule}
            suppressed={appt.remindersSuppressed}
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
                  <button onClick={() => removeExtraRecipient(i)} aria-label={`Remove ${r.email || r.phone}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
              <input className="input" placeholder="Name (optional)" value={extraName} onChange={(e) => setExtraName(e.target.value)} aria-label="Recipient name" />
              <input className="input" placeholder="Email or phone" value={extraEmail} onChange={(e) => setExtraEmail(e.target.value)} aria-label="Recipient email or phone" />
              <Button variant="outline" size="sm" style={{ height: 36 }} onClick={addExtraRecipient} disabled={!extraEmail.trim()}>
                <Plus size={13} /> Add
              </Button>
            </div>
          </Card>

          <ActivityTimeline events={appt.timeline} />
        </div>

        {/* RIGHT — sidebar column */}
        <div className="stack">
          <Card title={<><User size={15} className="muted" /> Customer</>}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
              <span className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>SJ</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{appt.inviteeName}</div>
                <a href="#" onClick={(e) => { e.preventDefault(); showToast("Opening contact record…"); }} style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
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

          <VideoMeetingPanel onCopied={() => showToast("Guest link copied.")} />
          <NotetakerPanel />

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
            </div>
          </Card>
        </div>
      </div>

      {rescheduleOpen && (
        <RescheduleModal
          timezone={appt.timezone}
          onClose={() => setRescheduleOpen(false)}
          onSave={saveReschedule}
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
