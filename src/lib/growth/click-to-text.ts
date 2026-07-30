export function buildClickToTextHref(phoneE164: string, body: string) {
  const digits = phoneE164.replace(/[^\d+]/g, "");
  const encoded = encodeURIComponent(body);
  return `sms:${digits}?body=${encoded}`;
}
