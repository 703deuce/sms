import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { publicToken } from "@/lib/appointments/settings";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { resetAppointmentReminders } from "@/lib/appointments/reminder-state";

export type ManualAppointmentInput = {
  inviteeName: string;
  inviteeEmail?: string;
  inviteePhone?: string;
  serviceName?: string;
  startsAt: Date;
  endsAt?: Date;
  timezone?: string;
  staffName?: string;
  location?: string;
  notes?: string;
};

export async function createManualArAppointment(workspaceId: string, input: ManualAppointmentInput) {
  const prisma = getPrisma();
  const phone = input.inviteePhone ? normalizeE164(input.inviteePhone) : null;
  const externalId = `manual:${createId()}`;
  const confirmToken = publicToken();
  const cancelToken = publicToken();
  const rescheduleToken = publicToken();

  const metadata: AppointmentMetadata = {
    source: "admin",
    inviteeName: input.inviteeName.trim(),
    inviteeEmail: input.inviteeEmail?.trim() || undefined,
    inviteePhone: phone || undefined,
    confirmToken,
    cancelToken,
    rescheduleToken,
    location: input.location,
    notes: input.notes,
    bookingSource: "ar_manual",
    initiatedBy: "staff",
  };

  const endsAt = input.endsAt ?? new Date(input.startsAt.getTime() + 30 * 60_000);

  const row = await prisma.voiceAppointment.create({
    data: {
      workspaceId,
      externalId,
      serviceName: input.serviceName?.trim() || "Appointment",
      staffName: input.staffName?.trim() || null,
      startsAt: input.startsAt,
      endsAt,
      timezone: input.timezone || "America/New_York",
      status: "scheduled",
      metadata: resetAppointmentReminders(metadata) as object,
    },
  });

  return row;
}

export type CsvImportRow = {
  rowNumber: number;
  inviteeName: string;
  startsAt: Date;
  inviteeEmail?: string;
  inviteePhone?: string;
  serviceName?: string;
  timezone?: string;
  errors: string[];
};

export function parseArAppointmentCsv(text: string, defaultTimezone: string): CsvImportRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const idx = (name: string) => header.indexOf(name);

  const nameI = idx("name") >= 0 ? idx("name") : idx("invitee_name");
  const dateI = idx("date") >= 0 ? idx("date") : idx("appointment_date");
  const timeI = idx("time") >= 0 ? idx("time") : idx("appointment_time");
  const emailI = idx("email");
  const phoneI = idx("phone");
  const serviceI = idx("service") >= 0 ? idx("service") : idx("service_name");
  const tzI = idx("timezone");

  const rows: CsvImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const errors: string[] = [];
    const inviteeName = nameI >= 0 ? cols[nameI]?.trim() : "";
    if (!inviteeName) errors.push("Missing name");

    const dateStr = dateI >= 0 ? cols[dateI]?.trim() : "";
    const timeStr = timeI >= 0 ? cols[timeI]?.trim() : "09:00";
    let startsAt: Date | null = null;
    if (!dateStr) {
      errors.push("Missing date");
    } else {
      const parsed = Date.parse(`${dateStr}T${timeStr || "09:00"}:00`);
      if (Number.isNaN(parsed)) errors.push("Invalid date/time");
      else startsAt = new Date(parsed);
    }

    const email = emailI >= 0 ? cols[emailI]?.trim() : undefined;
    const phone = phoneI >= 0 ? cols[phoneI]?.trim() : undefined;
    if (!email && !phone) errors.push("Need email or phone for reminders");

    rows.push({
      rowNumber: i + 1,
      inviteeName: inviteeName || `Row ${i + 1}`,
      startsAt: startsAt || new Date(),
      inviteeEmail: email,
      inviteePhone: phone,
      serviceName: serviceI >= 0 ? cols[serviceI]?.trim() : undefined,
      timezone: tzI >= 0 ? cols[tzI]?.trim() : defaultTimezone,
      errors,
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.replace(/^"|"$/g, "").trim());
}

export async function importArAppointmentsFromCsv(
  workspaceId: string,
  text: string,
  defaultTimezone: string,
): Promise<{ created: number; skipped: number; errors: Array<{ row: number; messages: string[] }> }> {
  const parsed = parseArAppointmentCsv(text, defaultTimezone);
  let created = 0;
  let skipped = 0;
  const errors: Array<{ row: number; messages: string[] }> = [];

  const prisma = getPrisma();

  for (const row of parsed) {
    if (row.errors.length) {
      skipped += 1;
      errors.push({ row: row.rowNumber, messages: row.errors });
      continue;
    }

    if (row.inviteeEmail) {
      const existing = await prisma.voiceAppointment.findFirst({
        where: {
          workspaceId,
          startsAt: row.startsAt,
          metadata: { path: ["inviteeEmail"], equals: row.inviteeEmail },
        },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        errors.push({ row: row.rowNumber, messages: ["Duplicate appointment (same email and time)"] });
        continue;
      }
    }

    await createManualArAppointment(workspaceId, {
      inviteeName: row.inviteeName,
      inviteeEmail: row.inviteeEmail,
      inviteePhone: row.inviteePhone,
      serviceName: row.serviceName,
      startsAt: row.startsAt,
      timezone: row.timezone || defaultTimezone,
    });
    created += 1;
  }

  return { created, skipped, errors };
}
