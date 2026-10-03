export const VOICEMAIL_STORAGE_URL_PREFIX = "supabase:";

export function buildVoicemailStorageRecordingUrl(bucket: string, path: string): string {
  return `${VOICEMAIL_STORAGE_URL_PREFIX}${bucket}:${path}`;
}

export function parseVoicemailStorageRecordingUrl(
  recordingUrl: string,
): { bucket: string; path: string } | null {
  if (!recordingUrl.startsWith(VOICEMAIL_STORAGE_URL_PREFIX)) return null;
  const rest = recordingUrl.slice(VOICEMAIL_STORAGE_URL_PREFIX.length);
  const separator = rest.indexOf(":");
  if (separator <= 0) return null;
  const bucket = rest.slice(0, separator);
  const path = rest.slice(separator + 1);
  if (!bucket || !path) return null;
  return { bucket, path };
}

const SUPABASE_SLASH_RECORDING_PREFIX = "supabase://";

/** Canonical storage refs: `supabase:bucket:path` or legacy `supabase://bucket/path`. */
export function parseAnyVoicemailRecordingStorageRef(
  recordingUrl: string,
): { bucket: string; path: string } | null {
  const colonForm = parseVoicemailStorageRecordingUrl(recordingUrl);
  if (colonForm) return colonForm;
  if (!recordingUrl.startsWith(SUPABASE_SLASH_RECORDING_PREFIX)) return null;
  const rest = recordingUrl.slice(SUPABASE_SLASH_RECORDING_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  const path = rest.slice(slash + 1);
  if (!bucket || !path) return null;
  return { bucket, path };
}
