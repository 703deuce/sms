export type InboxListCursor = {
  updatedAt: string;
  id: string;
};

export const INBOX_LIST_DEFAULT_TAKE = 50;
export const INBOX_LIST_MAX_TAKE = 100;

export function encodeInboxCursor(cursor: InboxListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeInboxCursor(raw: string | null | undefined): InboxListCursor | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as InboxListCursor;
    if (!parsed?.updatedAt || !parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseInboxTake(raw: string | null | undefined): number {
  const n = Number(raw || INBOX_LIST_DEFAULT_TAKE);
  if (!Number.isFinite(n)) return INBOX_LIST_DEFAULT_TAKE;
  return Math.min(INBOX_LIST_MAX_TAKE, Math.max(1, Math.floor(n)));
}
