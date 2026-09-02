/**
 * Data adapter: maps /api/contacts ↔ Kimi contacts mock types.
 */
import type { Contact as ApiContact } from "@/lib/types";
import type { Contact as KimiContact } from "@/components/kimi/contacts/mock-data";
import { parseCsv } from "@/lib/contacts/parse-csv";

function formatCreated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function mapOptIn(status: string): KimiContact["status"] {
  const s = status.toUpperCase();
  if (s === "SUBSCRIBED") return "Subscribed";
  if (s === "UNSUBSCRIBED") return "Unsubscribed";
  if (s === "BLOCKED") return "Blocked";
  return "Not Subscribed";
}

export function mapOptInLabelToApiStatus(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (normalized === "subscribed") return "SUBSCRIBED";
  if (normalized === "blocked") return "BLOCKED";
  if (normalized === "unsubscribed") return "UNSUBSCRIBED";
  if (normalized === "not subscribed") return "UNSUBSCRIBED";
  return "SUBSCRIBED";
}

export function mapApiContactToKimi(c: ApiContact): KimiContact {
  return {
    id: c.id,
    firstName: c.firstName || "",
    lastName: c.lastName || "",
    mobile: c.phone || "",
    email: c.email || "",
    status: mapOptIn(c.status),
    created: formatCreated(c.dateAdded || (c as { createdAt?: string }).createdAt || ""),
  };
}

export type KimiContactStats = { contacts: number; subscribed: number; unsubscribed: number };

export async function fetchContacts(): Promise<KimiContact[]> {
  const res = await fetch("/api/contacts?take=200");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load contacts");
  return (json.data || []).map((c: ApiContact) => mapApiContactToKimi(c));
}

export async function fetchContactStats(): Promise<KimiContactStats> {
  const res = await fetch("/api/contacts/stats");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load contact stats");
  return {
    contacts: json.data?.contacts ?? 0,
    subscribed: json.data?.subscribed ?? 0,
    unsubscribed: json.data?.unsubscribed ?? 0,
  };
}

export async function fetchContactById(id: string): Promise<KimiContact | null> {
  const res = await fetch(`/api/contacts/${encodeURIComponent(id)}`);
  const json = await res.json();
  if (!res.ok) return null;
  return mapApiContactToKimi(json.data as ApiContact);
}

export async function updateContact(
  id: string,
  payload: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    optInLabel?: string;
  },
): Promise<void> {
  const res = await fetch(`/api/contacts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      status: payload.optInLabel ? mapOptInLabelToApiStatus(payload.optInLabel) : undefined,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not update contact");
}

export async function createContact(payload: {
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  status?: string;
  optInLabel?: string;
}): Promise<void> {
  const status = mapOptInLabelToApiStatus(payload.optInLabel || payload.status || "Subscribed");
  const res = await fetch("/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      email: payload.email,
      status,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not create contact");
}

export type KimiImportPayload = {
  file: File;
  mapping: Record<string, string>;
  optInChoice: string;
  selectedLists: string[];
  headerRow: boolean;
};

function kimiFieldToRowKey(field: string): "firstName" | "lastName" | "phone" | "email" | "optInLabel" | null {
  if (field === "First Name") return "firstName";
  if (field === "Last Name") return "lastName";
  if (field === "Mobile Number" || field === "Mobile") return "phone";
  if (field === "Email") return "email";
  if (field === "Opt-In Status") return "optInLabel";
  return null;
}

function guessKimiField(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (h.includes("firstname") || h === "first") return "First Name";
  if (h.includes("lastname") || h === "last") return "Last Name";
  if (h.includes("phone") || h.includes("mobile") || h.includes("cell")) return "Mobile Number";
  if (h.includes("email")) return "Email";
  if (h.includes("optin") || h.includes("status") || h.includes("subscribe")) return "Opt-In Status";
  return "None";
}

export function parseImportCsvColumns(
  text: string,
  headerRow: boolean,
): { columns: Array<{ name: string; sample: string }>; mapping: Record<string, string> } {
  const allRows = parseCsv(text);
  if (!allRows.length) return { columns: [], mapping: {} };

  const headers = headerRow ? allRows[0] : allRows[0].map((_, i) => `Column ${i + 1}`);
  const sampleRow = headerRow ? allRows[1] : allRows[0];
  const columns = headers.map((name, idx) => ({
    name: name || `Column ${idx + 1}`,
    sample: sampleRow?.[idx] || "",
  }));
  const mapping: Record<string, string> = {};
  for (const col of columns) {
    mapping[col.name] = guessKimiField(col.name);
  }
  return { columns, mapping };
}

export async function importContacts(payload: KimiImportPayload): Promise<{ created: number; updated: number }> {
  const text = await payload.file.text();
  const allRows = parseCsv(text);
  if (!allRows.length) throw new Error("CSV file is empty");

  const headers = payload.headerRow
    ? allRows[0]
    : allRows[0].map((_, i) => `Column ${i + 1}`);
  const dataRows = payload.headerRow ? allRows.slice(1) : allRows;

  const useColumnOptIn = payload.optInChoice === "Use the assigned opt-in status column";
  const defaultStatus = mapOptInLabelToApiStatus(
    useColumnOptIn ? "Subscribed" : payload.optInChoice || "Subscribed",
  );

  const rows = dataRows
    .map((row) => {
      const out: {
        phone?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        status?: string;
      } = {};
      for (const [colName, kimiField] of Object.entries(payload.mapping)) {
        const colIdx = headers.findIndex((h) => h === colName);
        if (colIdx < 0 || kimiField === "None") continue;
        const val = row[colIdx]?.trim() || "";
        const key = kimiFieldToRowKey(kimiField);
        if (key === "optInLabel") {
          if (useColumnOptIn && val) out.status = mapOptInLabelToApiStatus(val);
        } else if (key) {
          out[key] = val;
        }
      }
      if (!out.status) out.status = defaultStatus;
      return out;
    })
    .filter((r) => r.phone);

  if (!rows.length) {
    throw new Error("No rows with a mapped phone number found. Map a column to Mobile Number.");
  }

  const listName = payload.selectedLists[0] || undefined;

  async function submitImport(attestationId?: string) {
    const res = await fetch("/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows,
        listName,
        consentSource: "csv_import",
        marketingImport: Boolean(attestationId),
        attestationId,
      }),
    });
    const json = await res.json();
    return { res, json };
  }

  let { res, json } = await submitImport();
  if (!res.ok && String(json.error || "").toLowerCase().includes("attestation")) {
    const attestRes = await fetch("/api/mass-texting/import-attestation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listName,
        contactCount: rows.length,
        attestationAccepted: true,
        source: "csv_import",
      }),
    });
    const attestJson = await attestRes.json();
    if (!attestRes.ok) {
      throw new Error(attestJson.error || "List consent attestation failed");
    }
    ({ res, json } = await submitImport(attestJson.data?.id));
  }

  if (!res.ok) throw new Error(json.error || "Import failed");
  return {
    created: json.data?.created ?? 0,
    updated: json.data?.updated ?? 0,
  };
}

export async function deleteContact(id: string): Promise<void> {
  const res = await fetch(`/api/contacts/${encodeURIComponent(id)}`, { method: "DELETE" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Could not delete contact");
}

export async function deleteContacts(ids: string[]): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;
  await Promise.all(
    ids.map(async (id) => {
      try {
        await deleteContact(id);
        deleted += 1;
      } catch {
        failed += 1;
      }
    }),
  );
  return { deleted, failed };
}

export async function fetchContactLists(): Promise<string[]> {
  const res = await fetch("/api/contacts/lists");
  const json = await res.json();
  if (!res.ok) return [];
  return (json.data || []).map((l: { name: string }) => l.name);
}
