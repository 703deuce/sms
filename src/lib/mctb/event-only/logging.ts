import { MCTB_EVENT_ONLY_LOG_SOURCE } from "@/lib/mctb/event-only/types";

export function logMctbEventOnly(event: string, extra: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      source: MCTB_EVENT_ONLY_LOG_SOURCE,
      event,
      timestamp: new Date().toISOString(),
      ...extra,
    }),
  );
}
