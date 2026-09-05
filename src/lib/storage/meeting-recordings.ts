import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import {
  getTelnyxStorageEndpoint,
  getTelnyxStorageRegion,
  isTelnyxStorageConfigured,
} from "@/lib/voice/telnyx/storage";

export type MeetingRecordingAccess = {
  url: string | null;
  source: "storage" | "provider" | null;
  temporary?: boolean;
};

export function parseStoredRecordingPath(storedPath: string): { bucket: string; key: string } | null {
  const trimmed = storedPath.trim();
  if (!trimmed || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return null;
  }
  const slash = trimmed.indexOf("/");
  if (slash <= 0) return null;
  return {
    bucket: trimmed.slice(0, slash),
    key: trimmed.slice(slash + 1),
  };
}

function getTelnyxS3Client() {
  const apiKey = getTelnyxApiKey();
  if (!apiKey) throw new Error("TELNYX_API_KEY required for Telnyx Cloud Storage");
  return new S3Client({
    region: getTelnyxStorageRegion(),
    endpoint: getTelnyxStorageEndpoint(),
    forcePathStyle: true,
    credentials: {
      accessKeyId: apiKey,
      secretAccessKey: apiKey,
    },
  });
}

export async function createStoredMeetingRecordingUrl(
  storedPath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!isTelnyxStorageConfigured()) return null;
  const parsed = parseStoredRecordingPath(storedPath);
  if (!parsed) return null;
  try {
    const client = getTelnyxS3Client();
    return await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
      { expiresIn: expiresInSeconds },
    );
  } catch {
    return null;
  }
}

export async function resolveMeetingRecordingAccess(input: {
  recordingStoragePath?: string | null;
  recordingProviderUrl?: string | null;
}): Promise<MeetingRecordingAccess> {
  if (input.recordingStoragePath) {
    const signed = await createStoredMeetingRecordingUrl(input.recordingStoragePath);
    if (signed) {
      return { url: signed, source: "storage", temporary: false };
    }
  }

  if (input.recordingProviderUrl) {
    console.warn(
      "[meeting-recordings] Using temporary provider recording URL — configure TELNYX_STORAGE_* for durable playback.",
    );
    return { url: input.recordingProviderUrl, source: "provider", temporary: true };
  }

  return { url: null, source: null };
}
