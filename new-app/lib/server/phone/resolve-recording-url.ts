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

function pickDownloadUrl(urls?: { mp3?: string; wav?: string } | null) {
  return urls?.mp3 || urls?.wav || null;
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
    const first = res.data?.[0];
    if (first?.id) {
      const byId = await fetchRecordingById(first.id);
      if (byId) return byId;
    }
    return pickDownloadUrl(first?.download_urls);
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
export async function resolveHumanCallRecordingDownloadUrl(input: {
  recordingUrl: string | null;
  telnyxCallControlId: string | null;
  metadata: unknown;
}): Promise<string | null> {
  const meta = (input.metadata || {}) as Record<string, unknown>;
  const recordingId =
    typeof meta.telnyxRecordingId === "string" ? meta.telnyxRecordingId : null;
  const parentControlId =
    typeof meta.callerCallControlId === "string"
      ? meta.callerCallControlId
      : typeof meta.parentCallControlId === "string"
        ? meta.parentCallControlId
        : input.telnyxCallControlId;

  if (recordingId) {
    const fresh = await fetchRecordingById(recordingId);
    if (fresh) return fresh;
  }

  if (input.recordingUrl && (await storedUrlStillValid(input.recordingUrl))) {
    return input.recordingUrl;
  }

  if (parentControlId) {
    const fromList = await listRecordingByCallControlId(parentControlId);
    if (fromList) return fromList;
  }

  return null;
}
