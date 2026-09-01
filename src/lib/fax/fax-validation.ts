import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { FAX_MAX_FILE_BYTES, FAX_MAX_PAGES } from "./types";

export function normalizeFaxE164(input: string): string {
  return normalizeE164(input.trim());
}

export function validateFaxRecipient(to: string): { ok: true; e164: string } | { ok: false; error: string } {
  const trimmed = to.trim();
  if (!trimmed) return { ok: false, error: "Enter a destination fax number." };
  try {
    const e164 = normalizeFaxE164(trimmed);
    if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
      return { ok: false, error: "Enter a valid fax number in international format." };
    }
    return { ok: true, e164 };
  } catch {
    return { ok: false, error: "Enter a valid fax number." };
  }
}

export function validateFaxDocument(input: {
  bytes: Buffer;
  mimeType?: string | null;
  filename?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (!input.bytes?.length) {
    return { ok: false, error: "Choose a document to fax." };
  }
  if (input.bytes.length > FAX_MAX_FILE_BYTES) {
    return { ok: false, error: "This file is larger than the maximum allowed size (50 MB)." };
  }
  const mime = (input.mimeType || "").toLowerCase();
  const name = (input.filename || "").toLowerCase();
  const isPdf = mime.includes("pdf") || name.endsWith(".pdf");
  if (!isPdf) {
    return { ok: false, error: "Only PDF documents are supported in this version." };
  }
  return { ok: true };
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200) || "document.pdf";
}

export async function estimatePdfPageCount(bytes: Buffer): Promise<number | null> {
  const text = bytes.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  if (matches?.length) return Math.min(matches.length, FAX_MAX_PAGES);
  return null;
}
