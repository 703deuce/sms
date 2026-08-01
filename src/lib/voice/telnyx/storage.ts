/**
 * Telnyx Cloud Storage (S3-compatible) helpers for AI RAG knowledge bases.
 *
 * Auth: Telnyx documents using the API key as both Access Key ID and Secret Key.
 * Endpoint: https://{region}.telnyxcloudstorage.com
 */

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";

export function getTelnyxStorageRegion() {
  return process.env.TELNYX_STORAGE_REGION?.trim() || "us-east-1";
}

export function getTelnyxStorageEndpoint() {
  const region = getTelnyxStorageRegion();
  return (
    process.env.TELNYX_STORAGE_ENDPOINT?.replace(/\/$/, "") ||
    `https://${region}.telnyxcloudstorage.com`
  );
}

export function isTelnyxStorageConfigured() {
  return Boolean(getTelnyxApiKey());
}

function getS3Client() {
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

/** DNS-safe unique bucket name for a knowledge base. */
export function knowledgeBucketName(workspaceId: string, knowledgeBaseId: string) {
  const prefix = (process.env.TELNYX_KB_BUCKET_PREFIX || "transovo-kb").toLowerCase();
  return `${prefix}-${workspaceId.slice(0, 8)}-${knowledgeBaseId.slice(0, 12)}`.toLowerCase();
}

export async function ensureKnowledgeBucket(bucketName: string) {
  const client = getS3Client();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return { bucketName, created: false };
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
    return { bucketName, created: true };
  }
}

export async function uploadKnowledgeObject(input: {
  bucketName: string;
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
}) {
  const client = getS3Client();
  await ensureKnowledgeBucket(input.bucketName);
  const body =
    typeof input.body === "string" ? Buffer.from(input.body, "utf8") : input.body;
  await client.send(
    new PutObjectCommand({
      Bucket: input.bucketName,
      Key: input.key,
      Body: body,
      ContentType: input.contentType || "application/octet-stream",
    }),
  );
  return { bucketName: input.bucketName, key: input.key };
}

export async function deleteKnowledgeObject(bucketName: string, key: string) {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}
