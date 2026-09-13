export function validateBookingLinkUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "URL is required" };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "URL must start with http:// or https://" };
    }
    if (!parsed.hostname) return { ok: false, error: "Invalid URL" };
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
}

export function bookingLinkHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
