const EMAIL_RE =
  /^[A-Za-z0-9][A-Za-z0-9._%+-]*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export function normalizeSpokenEmail(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/\s+at\s+/g, "@");
  value = value.replace(/\s+dot\s+/g, ".");
  value = value.replace(/\s+/g, "");
  return value;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}
