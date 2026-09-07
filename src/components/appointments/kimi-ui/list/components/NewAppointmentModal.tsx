import { useMemo, useState } from "react";
import { Modal } from "./Modal";

const inputCls = "tv-input";
const labelCls = "tv-fieldlabel";

export function NewAppointmentModal({
  open,
  onClose,
  bookingTypes,
  staffNames,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  bookingTypes: Array<{ id: string; name: string; durationMinutes: number; location?: string | null }>;
  staffNames: string[];
  onCreate: (payload: {
    inviteeName: string;
    inviteePhone: string | null;
    inviteeEmail: string | null;
    serviceName: string;
    startsAt: string;
    staffName: string;
    notes: string;
    sendSms: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [typeId, setTypeId] = useState(bookingTypes[0]?.id ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [staff, setStaff] = useState(staffNames[0] ?? "You");
  const [notes, setNotes] = useState("");
  const [sms, setSms] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const type = useMemo(
    () => bookingTypes.find((t) => t.id === typeId) ?? bookingTypes[0],
    [bookingTypes, typeId],
  );

  const reset = () => {
    setName("");
    setPhone("");
    setEmail("");
    setTypeId(bookingTypes[0]?.id ?? "");
    setDate(new Date().toISOString().slice(0, 10));
    setTime("10:00");
    setStaff(staffNames[0] ?? "You");
    setNotes("");
    setSms(true);
    setErrors({});
    setSaving(false);
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Enter the customer's name.";
    if (!phone.trim() && !email.trim()) errs.phone = "Enter a phone number or email for reminders.";
    if (!date) errs.date = "Choose a date.";
    if (!type) errs.type = "Choose a booking type.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const startsAt = new Date(`${date}T${time}:00`).toISOString();
      await onCreate({
        inviteeName: name.trim(),
        inviteePhone: phone.trim() || null,
        inviteeEmail: email.trim() || null,
        serviceName: type.name,
        startsAt,
        staffName: staff,
        notes,
        sendSms: sms,
      });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="New appointment"
      description="Create a manual booking. The customer receives a confirmation and reminders based on the booking type."
      wide
      footer={
        <>
          <button type="button" className="tv-btn tv-btn--ghost" onClick={() => { reset(); onClose(); }}>
            Cancel
          </button>
          <button type="button" className="tv-btn tv-btn--primary" onClick={save} disabled={saving}>
            {saving ? "Creating…" : "Create appointment"}
          </button>
        </>
      }
    >
      <div className="tv-formgrid">
        <div className="tv-formsection">Customer</div>
        <div className="tv-field tv-field--full">
          <label className={labelCls} htmlFor="na-name">Full name</label>
          <input id="na-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sarah Johnson" aria-invalid={!!errors.name} />
          {errors.name && <p className="tv-fielderror" role="alert">{errors.name}</p>}
        </div>
        <div className="tv-field">
          <label className={labelCls} htmlFor="na-phone">Mobile number</label>
          <input id="na-phone" type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(571) 555-1234" aria-invalid={!!errors.phone} />
          {errors.phone && <p className="tv-fielderror" role="alert">{errors.phone}</p>}
        </div>
        <div className="tv-field">
          <label className={labelCls} htmlFor="na-email">Email — Optional</label>
          <input id="na-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>

        <div className="tv-formsection">Appointment</div>
        <div className="tv-field tv-field--full">
          <label className={labelCls} htmlFor="na-type">Booking type</label>
          <select id="na-type" className={inputCls} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {bookingTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name} · {t.durationMinutes} min</option>
            ))}
          </select>
        </div>
        <div className="tv-field">
          <label className={labelCls} htmlFor="na-date">Date</label>
          <input id="na-date" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date} />
          {errors.date && <p className="tv-fielderror" role="alert">{errors.date}</p>}
        </div>
        <div className="tv-field">
          <label className={labelCls} htmlFor="na-time">Start time (Eastern)</label>
          <input id="na-time" type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="tv-field tv-field--full">
          <label className={labelCls} htmlFor="na-staff">Staff</label>
          <select id="na-staff" className={inputCls} value={staff} onChange={(e) => setStaff(e.target.value)}>
            {staffNames.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="tv-field tv-field--full">
          <label className={labelCls} htmlFor="na-notes">Notes — Optional</label>
          <textarea id="na-notes" className="tv-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gate code, customer preferences…" />
        </div>

        <div className="tv-formsection">Communication</div>
        <label className="tv-checkrow tv-field--full" htmlFor="na-sms">
          <input id="na-sms" type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} />
          <span>
            <span className="tv-strong" style={{ fontSize: 13 }}>Send SMS confirmation and reminders</span>
            <span className="tv-muted" style={{ display: "block" }}>
              Preview: “Hi {'{first name}'}, this is a reminder for your {type?.name ?? "appointment"} on {'{date}'} at {'{time}'}. Reply YES to confirm.”
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
