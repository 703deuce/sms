import { telnyxRequest } from "@/lib/server/telnyx/client";
import { phoneServerLog } from "@/lib/server/phone/phone-log";

type RecordingApi = {
  data?: {
    download_urls?: { mp3?: string; wav?: string };
  };
};

type RecordingListApi = {
  data?: Array<{ id?: string; download_urls?: { mp3?: string; wav?: string } }>;
};

export type HumanCallRecordingFields = {
  recordingUrl: string | null;
  telnyxCallControlId: string | null;
  telnyxCallLegId?: string | null;
  recordingStartedAt?: Date | null;
  metadata: unknown;
};

function pickDownloadUrl(urls?: { mp3?: string; wav?: string } | null) {
  return urls?.mp3 || urls?.wav || null;
}

function metaAsRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
}

/** All Telnyx call_control ids that might own the recording for this HumanCall. */
export function collectHumanCallRecordingControlIds(input: HumanCallRecordingFields): string[] {
  const meta = metaAsRecord(input.metadata);
  const ids = new Set<string>();
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) ids.add(v.trim());
  };
  push(input.telnyxCallControlId);
  push(input.telnyxCallLegId);
  push(meta.callerCallControlId);
  push(meta.browserCallControlId);
  push(meta.parentCallControlId);
  push(meta.agentCallControlId);
  return [...ids];
}

export function humanCallHasRecordingArtifact(input: HumanCallRecordingFields): boolean {
  const meta = metaAsRecord(input.metadata);
  return Boolean(
    input.recordingUrl ||
      input.recordingStartedAt ||
      (typeof meta.telnyxRecordingId === "string" && meta.telnyxRecordingId) ||
      collectHumanCallRecordingControlIds(input).length > 0,
  );
}

async function fetchRecordingById(recordingId: string): Promise<string | null> {
  try {
    const res = await telnyxRequest<RecordingApi>(`/recordings/${encodeURIComponent(recordingId)}`);
    return pickDownloadUrl(res.data?.download_urls);
  } catch (err) {
    phoneServerLog("recording-url", "telnyx_get_failed", {
      recordingId,
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

async function listRecordingByCallControlId(callControlId: string): Promise<string | null> {
  try {
    const res = await telnyxRequest<RecordingListApi>("/recordings", {
      query: { "filter[call_control_id]": callControlId },
    });
    const rows = res.data || [];
    for (const row of rows) {
      if (row?.id) {
        const byId = await fetchRecordingById(row.id);
        if (byId) return byId;
      }
      const direct = pickDownloadUrl(row?.download_urls);
      if (direct) return direct;
    }
    return null;
  } catch (err) {
    phoneServerLog("recording-url", "telnyx_list_failed", {
      callControlPrefix: callControlId.slice(0, 8),
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

async function storedUrlStillValid(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Telnyx webhook URLs expire (~10m). Resolve a fresh download link when needed. */
export async function resolveHumanCallRecordingDownloadUrl(
  input: HumanCallRecordingFields,
): Promise<string | null> {
  const meta = metaAsRecord(input.metadata);
  const recordingId =
    typeof meta.telnyxRecordingId === "string" ? meta.telnyxRecordingId : null;

  if (recordingId) {
    const fresh = await fetchRecordingById(recordingId);
    if (fresh) return fresh;
  }

  if (input.recordingUrl && (await storedUrlStillValid(input.recordingUrl))) {
    return input.recordingUrl;
  }

  for (const controlId of collectHumanCallRecordingControlIds(input)) {
    const fromList = await listRecordingByCallControlId(controlId);
    if (fromList) return fromList;
  }

  return null;
}
