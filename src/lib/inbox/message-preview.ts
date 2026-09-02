/** Human-readable preview for conversation list rows. */
export function formatMessagePreview(input: {
  body?: string | null;
  mediaUrls?: string[] | null;
  direction?: string;
}): string {
  const body = (input.body || "").trim();
  const mediaCount = input.mediaUrls?.filter(Boolean).length || 0;
  const isPlaceholder =
    body === "[Media attachment]" ||
    body.startsWith("[Inbound MMS") ||
    body.startsWith("[MMS") ||
    body.startsWith("[1 attachment") ||
    body.startsWith("[") && body.includes("attachment");

  if (body && !isPlaceholder) return body;
  if (mediaCount > 0) return mediaCount === 1 ? "📷 Photo" : `📷 ${mediaCount} photos`;
  if (body) return body;
  return "";
}
