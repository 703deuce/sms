/**
 * Deterministic identity extraction/normalization for Microsoft appointment discovery.
 * No server-only — safe for unit tests.
 */

export function normalizePhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function phonesEquivalent(a: string, b: string): boolean {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10 && da.slice(-10) === db.slice(-10)) return true;
  return false;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePersonName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}|\d{10,11}/g;

export function extractEmailsFromText(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(EMAIL_RE) ?? []) {
    out.add(normalizeEmail(m));
  }
  return [...out];
}

export function extractPhonesFromText(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(PHONE_RE) ?? []) {
    const d = normalizePhoneDigits(m);
    if (d.length >= 10) out.add(d);
  }
  return [...out];
}

/** Transovo BOOK body convention + free text. */
export function extractTransovoLabeledIdentity(plainBody: string): {
  email?: string;
  phone?: string;
} {
  const emailMatch = /Email:\s*([^\s\n]+)/i.exec(plainBody);
  const phoneMatch = /Phone:\s*([^\s\n]+)/i.exec(plainBody);
  return {
    email: emailMatch?.[1]?.trim(),
    phone: phoneMatch?.[1]?.trim(),
  };
}

export type ExtractedEventIdentity = {
  subject: string;
  bodyText: string;
  location: string;
  emails: string[];
  phones: string[];
  names: string[];
  serviceHints: string[];
};

export function extractIdentityFromEventFields(input: {
  subject?: string;
  description?: string;
  location?: string;
  attendeeNames?: string[];
  attendeeEmails?: string[];
}): ExtractedEventIdentity {
  const subject = (input.subject ?? "").trim();
  const bodyText = (input.description ?? "").trim();
  const location = (input.location ?? "").trim();
  const plainBody = bodyText.replace(/<[^>]+>/g, " ");

  const emails = new Set<string>();
  const phones = new Set<string>();
  const names = new Set<string>();

  for (const e of extractEmailsFromText(`${subject} ${plainBody}`)) emails.add(e);
  for (const p of extractPhonesFromText(`${subject} ${plainBody}`)) phones.add(p);

  const labeled = extractTransovoLabeledIdentity(plainBody);
  if (labeled.email) emails.add(normalizeEmail(labeled.email));
  if (labeled.phone) phones.add(normalizePhoneDigits(labeled.phone));

  for (const ae of input.attendeeEmails ?? []) {
    if (ae?.trim()) emails.add(normalizeEmail(ae));
  }
  for (const an of input.attendeeNames ?? []) {
    const n = normalizePersonName(an);
    if (n) names.add(n);
  }

  const dashName = /^([^-–—]+)[-–—]\s*(.+)$/u.exec(subject);
  if (dashName) {
    const left = normalizePersonName(dashName[1]!);
    const right = dashName[2]!.trim();
    if (left.length >= 2) names.add(left);
    if (right.length >= 3) {
      // service hint on right side of "Name - Service"
    }
  }

  const serviceHints: string[] = [];
  if (dashName && dashName[2]!.trim()) serviceHints.push(dashName[2]!.trim());

  return {
    subject,
    bodyText: plainBody,
    location,
    emails: [...emails],
    phones: [...phones],
    names: [...names],
    serviceHints,
  };
}

export function nameAppearsInEvent(normalizedName: string, identity: ExtractedEventIdentity): boolean {
  if (!normalizedName || normalizedName.length < 2) return false;
  const subjectNorm = normalizePersonName(identity.subject);
  if (subjectNorm.includes(normalizedName)) return true;
  if (identity.names.some((n) => n === normalizedName || n.includes(normalizedName))) return true;
  const bodyNorm = normalizePersonName(identity.bodyText);
  return bodyNorm.includes(normalizedName);
}
