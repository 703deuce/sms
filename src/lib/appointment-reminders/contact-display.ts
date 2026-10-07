import type { AppointmentMetadata } from "@/lib/appointments/types";
import { isValidReminderPhone, resolveReminderContactPhone } from "@/lib/appointment-reminders/aggregate-reminder-status";

export type ArContactDisplay = {
  customerName: string;
  appointmentTitle: string;
  phone: string | null;
  phoneState: "ok" | "missing" | "invalid" | "email_only";
  email: string | null;
};

function isEmailLike(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const v = value.trim();
  if (v.startsWith("email:")) return true;
  return v.includes("@") && !v.startsWith("+");
}

function normalizeStoredPhone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const v = raw.trim();
  if (v.startsWith("email:")) return null;
  if (isEmailLike(v)) return null;
  return v;
}

export function resolveArAppointmentContactDisplay(
  meta: AppointmentMetadata,
  inviteeName: string | null | undefined,
  inviteePhone: string | null | undefined,
  serviceName: string | null | undefined,
): ArContactDisplay {
  const title = serviceName?.trim() || "Appointment";
  const rawName = inviteeName?.trim() || (meta.inviteeName as string)?.trim() || "";
  const email =
    (meta.inviteeEmail as string)?.trim() ||
    (isEmailLike(inviteePhone) ? inviteePhone!.replace(/^email:/i, "") : null) ||
    (inviteePhone?.startsWith("email:") ? inviteePhone.slice(6) : null);

  let customerName = rawName;
  if (!customerName || customerName === title) {
    const attendee = (meta.attendeeName as string)?.trim();
    if (attendee && attendee !== title) customerName = attendee;
    else if (email) customerName = email.split("@")[0] || "Unknown customer";
    else customerName = "Unknown customer";
  }

  const appointmentTitle = rawName && rawName !== title ? title : title;

  const phoneRaw = resolveReminderContactPhone(meta, inviteePhone);
  const phone = normalizeStoredPhone(phoneRaw);

  let phoneState: ArContactDisplay["phoneState"] = "missing";
  if (phone && isValidReminderPhone(phone)) phoneState = "ok";
  else if (phone) phoneState = "invalid";
  else if (email) phoneState = "email_only";

  return {
    customerName,
    appointmentTitle: customerName === title ? "" : appointmentTitle,
    phone,
    phoneState,
    email,
  };
}
