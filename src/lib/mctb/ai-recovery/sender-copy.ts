import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";

const PHONE_LIKE = /^(\+?\d|\(\d{3}\))/;

/**
 * Field description for AI Recovery enable row — avoids duplicating "sender" + mode label.
 */
export function formatAiRecoverySenderDescription(
  senderLabel?: string | null,
  senderE164?: string | null,
): string {
  const inbox = " Your team can take over any time from the Inbox.";
  const phone =
    senderE164 && senderE164.trim() ? formatMctbPhoneLabel(senderE164.trim()) : null;
  if (phone) {
    return `AI replies from your active text-back sender, ${phone}.${inbox}`;
  }

  const label = (senderLabel ?? "").trim();
  if (!label || label === "—") {
    return `AI replies from your active text-back sender.${inbox}`;
  }
  if (label === "Your connected messaging number" || label === "Transovo recovery number") {
    return `AI replies from your active text-back sender.${inbox}`;
  }
  if (PHONE_LIKE.test(label)) {
    return `AI replies from your active text-back sender, ${label}.${inbox}`;
  }
  return `AI replies from your active text-back sender.${inbox}`;
}
