import { emitPlatformEvent } from "@/lib/platform/events";

export function emitBusinessImportEvent(
  type:
    | "VOICE_V3_BUSINESS_IMPORT_STARTED"
    | "VOICE_V3_BUSINESS_IMPORT_SOURCE_FETCHED"
    | "VOICE_V3_BUSINESS_IMPORT_SOURCE_FAILED"
    | "VOICE_V3_BUSINESS_IMPORT_EXTRACTION_COMPLETED"
    | "VOICE_V3_BUSINESS_IMPORT_DIFF_COMPLETED"
    | "VOICE_V3_BUSINESS_IMPORT_REVIEW_READY"
    | "VOICE_V3_BUSINESS_IMPORT_APPLIED"
    | "VOICE_V3_BUSINESS_IMPORT_FAILED",
  workspaceId: string,
  payload: Record<string, unknown>,
) {
  void emitPlatformEvent({
    workspaceId,
    type,
    payload,
  }).catch(() => undefined);
}
