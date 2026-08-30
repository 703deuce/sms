import { MCTB_CAPTURE_LOG_SOURCE } from "@/lib/mctb/capture/types";

export function logMctbCapture(event: string, extra: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      source: MCTB_CAPTURE_LOG_SOURCE,
      event,
      timestamp: new Date().toISOString(),
      ...extra,
    }),
  );
}

/** @deprecated Use logMctbCapture */
export const logMctbEventOnly = logMctbCapture;
