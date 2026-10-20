import { createId } from "@/lib/supabase/id";

const TRACE_PREFIX = "rec_";

export function createReceptionistTraceId(): string {
  return `${TRACE_PREFIX}${createId().replace(/-/g, "")}`;
}

export function parseReceptionistTraceIdFromRequest(
  request: Request,
  body?: { receptionistTraceId?: string | null },
): string | null {
  const header = request.headers.get("x-receptionist-trace-id")?.trim();
  if (header && header.startsWith(TRACE_PREFIX)) return header;
  const fromBody = body?.receptionistTraceId?.trim();
  if (fromBody && fromBody.startsWith(TRACE_PREFIX)) return fromBody;
  return null;
}

export function resolveReceptionistTraceId(
  request: Request,
  body?: { receptionistTraceId?: string | null },
): string {
  return parseReceptionistTraceIdFromRequest(request, body) ?? createReceptionistTraceId();
}
