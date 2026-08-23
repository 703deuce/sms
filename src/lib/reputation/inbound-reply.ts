/** Build Reply-To for Brevo inbound parsing: reply+{uuid}@reply.yourdomain.com */
export function buildInboundReplyAddress(entityId: string): string | null {
  const domain = process.env.REVIEW_REQUEST_REPLY_DOMAIN?.trim();
  if (!domain) return null;
  return `reply+${entityId}@${domain}`;
}

/** UUID from plus-addressed Reply-To (one-off send id or campaign message id). */
export function parseSendIdFromRecipient(recipient: string): string | null {
  const normalized = recipient.trim().toLowerCase();
  const plusMatch = normalized.match(/reply\+([0-9a-f-]{36})@/);
  if (plusMatch) return plusMatch[1];
  const dotMatch = normalized.match(/reply\.([0-9a-f-]{36})@/);
  if (dotMatch) return dotMatch[1];
  return null;
}

export function extractEmailAddress(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const angle = value.match(/<([^>]+)>/);
    if (angle) return angle[1].trim().toLowerCase();
    if (value.includes("@")) return value.trim().toLowerCase();
    return null;
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as { Address?: string; address?: string; email?: string };
    const addr = obj.Address ?? obj.address ?? obj.email;
    return addr ? addr.trim().toLowerCase() : null;
  }
  return null;
}

export function collectRecipientAddresses(to: unknown): string[] {
  if (!to) return [];
  if (typeof to === "string") return [to];
  if (Array.isArray(to)) {
    return to.flatMap((item) => {
      const addr = extractEmailAddress(item);
      return addr ? [addr] : [];
    });
  }
  const single = extractEmailAddress(to);
  return single ? [single] : [];
}

export type BrevoInboundItem = {
  sendId: string | null;
  fromEmail: string | null;
  fromName: string | null;
  subject: string | null;
  replyBody: string;
  inReplyTo: string | null;
  uuid: string | null;
};

function readString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

function parseInboundItem(raw: Record<string, unknown>): BrevoInboundItem | null {
  const recipients = [
    ...collectRecipientAddresses(raw.To),
    ...collectRecipientAddresses(raw.to),
    ...collectRecipientAddresses(raw.Recipients),
    ...collectRecipientAddresses(raw.recipient),
  ];

  let sendId: string | null = null;
  for (const r of recipients) {
    sendId = parseSendIdFromRecipient(r);
    if (sendId) break;
  }

  const fromObj = raw.From ?? raw.from;
  const fromEmail = extractEmailAddress(fromObj) ?? extractEmailAddress(raw.Sender ?? raw.sender);
  const fromName =
    typeof fromObj === "object" && fromObj !== null
      ? readString(fromObj as Record<string, unknown>, "Name", "name")
      : null;

  const replyBody =
    readString(raw, "ExtractedMarkdownMessage", "extractedMarkdownMessage") ??
    readString(raw, "RawTextBody", "rawTextBody", "text") ??
    readString(raw, "RawHtmlBody", "rawHtmlBody") ??
    "";

  if (!replyBody.trim() && !sendId && !fromEmail) return null;

  return {
    sendId,
    fromEmail,
    fromName,
    subject: readString(raw, "Subject", "subject"),
    replyBody: replyBody.trim(),
    inReplyTo: readString(raw, "InReplyTo", "inReplyTo"),
    uuid: readString(raw, "Uuid", "uuid", "MessageId", "messageId"),
  };
}

/** Normalize Brevo inbound webhook JSON (single item or batch). */
export function parseBrevoInboundPayload(body: unknown): BrevoInboundItem[] {
  if (!body || typeof body !== "object") return [];

  const root = body as Record<string, unknown>;
  const items: Record<string, unknown>[] = [];

  if (Array.isArray(root.items)) items.push(...(root.items as Record<string, unknown>[]));
  else if (Array.isArray(root.Items)) items.push(...(root.Items as Record<string, unknown>[]));
  else if (Array.isArray(body)) items.push(...(body as Record<string, unknown>[]));
  else items.push(root);

  return items.map(parseInboundItem).filter((item): item is BrevoInboundItem => item !== null);
}
