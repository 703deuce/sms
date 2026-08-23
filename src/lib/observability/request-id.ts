/** Request correlation helpers (propagated via x-request-id). */

export const REQUEST_ID_HEADER = "x-request-id";

export function resolveRequestId(incoming: string | null | undefined): string {
  const trimmed = incoming?.trim();
  if (trimmed && trimmed.length <= 128) return trimmed;
  return crypto.randomUUID();
}

export function getRequestId(request: Request): string {
  return resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
}
