import { createServiceClient } from "@/lib/db/client";
import { applyMapping, type CsvMapTarget } from "@/lib/reputation/bulk-csv";
import { normalizePhoneE164 } from "@/lib/reputation/phone";
import { contactIdentity, normalizeEmail } from "@/lib/reputation/contacts-normalize";
import { upsertBusinessContact } from "@/lib/reputation/contacts";

export type ContactImportMode = "create" | "update" | "skip";

export type ContactImportRow = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  customerDate?: string | null;
  notes?: string | null;
  tags?: string[];
  externalCustomerId?: string | null;
};

export type ContactPreviewRow = ContactImportRow & {
  rowIndex: number;
  phoneValid: boolean;
  emailValid: boolean;
  missingContact: boolean;
  duplicateInFile: boolean;
  existingContact: boolean;
  suppressed: boolean;
  status: "ready" | "invalid" | "duplicate" | "existing" | "suppressed";
  reason?: string;
};

export function mappedRowsToImportRows(
  headers: string[],
  rows: string[][],
  mapping: Record<string, CsvMapTarget>
): ContactImportRow[] {
  const applied = applyMapping(headers, rows, mapping);
  return applied.map((r) => ({
    firstName: r.first_name,
    lastName: r.last_name,
    fullName: r.full_name,
    phone: r.phone,
    email: r.email,
    customerDate: r.service_date,
    notes: r.notes,
    tags: r.job_type ? [r.job_type] : undefined,
  }));
}

export async function previewContactImport(params: {
  businessId: string;
  rows: ContactImportRow[];
}): Promise<{
  total: number;
  ready: number;
  invalid: number;
  duplicatesInFile: number;
  existing: number;
  suppressed: number;
  rows: ContactPreviewRow[];
}> {
  const supabase = createServiceClient();
  const { data: suppressions } = await supabase
    .from("review_request_suppression")
    .select("phone, email")
    .eq("business_id", params.businessId);

  const suppressedPhones = new Set(
    (suppressions ?? []).map((s) => s.phone).filter(Boolean) as string[]
  );
  const suppressedEmails = new Set(
    (suppressions ?? [])
      .map((s) => (s.email ? String(s.email).toLowerCase() : null))
      .filter(Boolean) as string[]
  );

  const phones = params.rows
    .map((r) => normalizePhoneE164(r.phone ?? "") )
    .filter(Boolean) as string[];
  const emails = params.rows
    .map((r) => normalizeEmail(r.email))
    .filter(Boolean) as string[];

  const existingPhone = new Set<string>();
  const existingEmail = new Set<string>();
  if (phones.length) {
    const { data } = await supabase
      .from("review_request_contacts")
      .select("phone_e164")
      .eq("business_id", params.businessId)
      .in("phone_e164", phones.slice(0, 1000));
    for (const c of data ?? []) {
      if (c.phone_e164) existingPhone.add(c.phone_e164);
    }
  }
  if (emails.length) {
    const { data } = await supabase
      .from("review_request_contacts")
      .select("email_normalized")
      .eq("business_id", params.businessId)
      .in("email_normalized", emails.slice(0, 1000));
    for (const c of data ?? []) {
      if (c.email_normalized) existingEmail.add(c.email_normalized);
    }
  }

  const seenPhone = new Set<string>();
  const seenEmail = new Set<string>();
  const out: ContactPreviewRow[] = [];

  for (let i = 0; i < params.rows.length; i++) {
    const row = params.rows[i];
    const id = contactIdentity({ phone: row.phone, email: row.email });
    const phoneValid = Boolean(id.phoneE164) || !row.phone?.trim();
    const emailValid = Boolean(id.emailNormalized) || !row.email?.trim();
    const missingContact = !id.phoneE164 && !id.emailNormalized;
    let duplicateInFile = false;
    if (id.phoneE164 && seenPhone.has(id.phoneE164)) duplicateInFile = true;
    if (id.emailNormalized && seenEmail.has(id.emailNormalized)) duplicateInFile = true;
    if (id.phoneE164) seenPhone.add(id.phoneE164);
    if (id.emailNormalized) seenEmail.add(id.emailNormalized);

    const existingContact =
      Boolean(id.phoneE164 && existingPhone.has(id.phoneE164)) ||
      Boolean(id.emailNormalized && existingEmail.has(id.emailNormalized));
    const suppressed =
      Boolean(id.phoneE164 && suppressedPhones.has(id.phoneE164)) ||
      Boolean(id.emailNormalized && suppressedEmails.has(id.emailNormalized));

    let status: ContactPreviewRow["status"] = "ready";
    let reason: string | undefined;
    if (missingContact || (!phoneValid && row.phone) || (!emailValid && row.email)) {
      status = "invalid";
      reason = missingContact ? "Missing phone and email" : "Invalid phone or email";
    } else if (suppressed) {
      status = "suppressed";
      reason = "Opted out / suppressed — will stay suppressed";
    } else if (duplicateInFile) {
      status = "duplicate";
      reason = "Duplicate in this file";
    } else if (existingContact) {
      status = "existing";
      reason = "Matches an existing contact";
    }

    out.push({
      ...row,
      rowIndex: i + 1,
      phoneValid: !row.phone?.trim() || Boolean(id.phoneE164),
      emailValid: !row.email?.trim() || Boolean(id.emailNormalized),
      missingContact,
      duplicateInFile,
      existingContact,
      suppressed,
      status,
      reason,
    });
  }

  return {
    total: out.length,
    ready: out.filter((r) => r.status === "ready" || r.status === "existing").length,
    invalid: out.filter((r) => r.status === "invalid").length,
    duplicatesInFile: out.filter((r) => r.status === "duplicate").length,
    existing: out.filter((r) => r.status === "existing").length,
    suppressed: out.filter((r) => r.status === "suppressed").length,
    rows: out,
  };
}

export async function runContactImport(params: {
  organizationId: string;
  businessId: string;
  uploadId: string;
  mode: ContactImportMode;
  rows: ContactImportRow[];
  userId?: string | null;
}): Promise<{ imported: number; skipped: number; failed: number; errors: Array<{ row: number; error: string }> }> {
  const supabase = createServiceClient();
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < params.rows.length; i++) {
    const row = params.rows[i];
    const identity = contactIdentity({ phone: row.phone, email: row.email });
    if (!identity.phoneE164 && !identity.emailNormalized) {
      failed++;
      errors.push({ row: i + 1, error: "Missing valid phone or email" });
      continue;
    }

    try {
      // Never import into a reactivation path for suppressed contacts.
      if (identity.phoneE164) {
        const { data: sup } = await supabase
          .from("review_request_suppression")
          .select("id")
          .eq("business_id", params.businessId)
          .eq("phone", identity.phoneE164)
          .limit(1);
        if (sup?.length) {
          skipped++;
          continue;
        }
      }
      if (identity.emailNormalized) {
        const { data: sup } = await supabase
          .from("review_request_suppression")
          .select("id")
          .eq("business_id", params.businessId)
          .eq("email", identity.emailNormalized)
          .limit(1);
        if (sup?.length) {
          skipped++;
          continue;
        }
      }

      let exists = false;
      if (identity.phoneE164) {
        const { data } = await supabase
          .from("review_request_contacts")
          .select("id, sms_opt_out, email_unsubscribed")
          .eq("business_id", params.businessId)
          .eq("phone_e164", identity.phoneE164)
          .maybeSingle();
        exists = Boolean(data);
        if (data?.sms_opt_out || data?.email_unsubscribed) {
          skipped++;
          continue;
        }
      }
      if (!exists && identity.emailNormalized) {
        const { data } = await supabase
          .from("review_request_contacts")
          .select("id, sms_opt_out, email_unsubscribed")
          .eq("business_id", params.businessId)
          .eq("email_normalized", identity.emailNormalized)
          .maybeSingle();
        exists = Boolean(data);
        if (data?.sms_opt_out || data?.email_unsubscribed) {
          skipped++;
          continue;
        }
      }

      if ((params.mode === "skip" || params.mode === "create") && exists) {
        skipped++;
        continue;
      }

      await upsertBusinessContact({
        organizationId: params.organizationId,
        businessId: params.businessId,
        firstName: row.firstName,
        lastName: row.lastName,
        customerName: row.fullName,
        phone: row.phone,
        email: row.email,
        notes: row.notes,
        tags: row.tags,
        externalCustomerId: row.externalCustomerId,
        customerDate: row.customerDate,
        source: "csv_import",
        consentState: "implied",
        consentSource: "csv_import",
      });
      imported++;
    } catch (e) {
      failed++;
      errors.push({
        row: i + 1,
        error: e instanceof Error ? e.message : "Import failed",
      });
    }
  }

  await supabase
    .from("review_request_uploads")
    .update({
      valid_rows: imported + skipped,
      imported_rows: imported,
      skipped_rows: skipped,
      failed_rows: failed,
      status: "completed",
      error_report_json: errors.slice(0, 500),
      completed_at: new Date().toISOString(),
      rows_json: null,
    })
    .eq("id", params.uploadId);

  return { imported, skipped, failed, errors };
}

export function errorReportToCsv(errors: Array<{ row: number; error: string }>): string {
  const lines = ["row,error"];
  for (const e of errors) {
    const msg = `"${String(e.error).replace(/"/g, '""')}"`;
    lines.push(`${e.row},${msg}`);
  }
  return lines.join("\n");
}
