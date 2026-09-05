import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import {
  ensureKnowledgeBucket,
  getTelnyxStorageEndpoint,
  getTelnyxStorageRegion,
  isTelnyxStorageConfigured,
} from "@/lib/voice/telnyx/storage";

function recordingsBucketName(workspaceId: string) {
  const prefix = (process.env.TELNYX_VIDEO_BUCKET_PREFIX || "transovo-video").toLowerCase();
  return `${prefix}-${workspaceId.slice(0, 12)}`.toLowerCase();
}

export async function uploadFromUrl(input: {
  url: string;
  key: string;
  contentType?: string;
  workspaceId?: string;
}): Promise<string | null> {
  if (!isTelnyxStorageConfigured()) {
    console.warn("[storage/upload-from-url] Telnyx storage unavailable — skipping durable copy.");
    return null;
  }

  const res = await fetch(input.url);
  if (!res.ok) return null;
  const body = Buffer.from(await res.arrayBuffer());
  const workspaceId = input.workspaceId || "shared";
  const bucketName = recordingsBucketName(workspaceId);
  await ensureKnowledgeBucket(bucketName);

  const apiKey = getTelnyxApiKey();
  if (!apiKey) return null;

  const client = new S3Client({
    region: getTelnyxStorageRegion(),
    endpoint: getTelnyxStorageEndpoint(),
    forcePathStyle: true,
    credentials: { accessKeyId: apiKey, secretAccessKey: apiKey },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: input.key,
      Body: body,
      ContentType: input.contentType || "application/octet-stream",
    }),
  );

  return `${bucketName}/${input.key}`;
}
