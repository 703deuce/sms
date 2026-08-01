/**
 * Telnyx RAG: embed storage buckets and attach retrieval tools to assistants.
 *
 * Flow:
 * 1. Upload docs to Telnyx Cloud Storage (see storage.ts)
 * 2. POST /ai/embeddings { bucket_name } — or /ai/embeddings/url for crawls
 * 3. On assistant create/update, include tools: [{ type: "retrieval", retrieval: { bucket_ids } }]
 *
 * This avoids stuffing long documents into the system prompt (context limits / forgetting).
 */

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import {
  isTelnyxStorageConfigured,
  knowledgeBucketName,
  uploadKnowledgeObject,
} from "./storage";

export function isTelnyxRagConfigured() {
  return Boolean(getTelnyxApiKey()) && isTelnyxStorageConfigured();
}

export async function embedBucket(bucketName: string) {
  return telnyxRequest<{
    data: { task_id?: string; status?: string; task_name?: string };
  }>("/ai/embeddings", {
    method: "POST",
    body: {
      bucket_name: bucketName,
      document_chunk_size: 1024,
      document_chunk_overlap_size: 128,
      embedding_model: "thenlper/gte-large",
    },
  });
}

/** Crawl a URL (and linked pages up to 5 levels) into a bucket + embed. */
export async function embedUrlIntoBucket(bucketName: string, url: string) {
  return telnyxRequest<{
    data: { task_id?: string; status?: string };
  }>("/ai/embeddings/url", {
    method: "POST",
    body: { bucket_name: bucketName, url },
  });
}

export async function getEmbeddingTaskStatus(taskId: string) {
  return telnyxRequest<{ data: { status?: string; finished_at?: string | null } }>(
    `/ai/embeddings/${taskId}`,
  );
}

/** Similarity search against an embedded bucket (for in-app knowledge test). */
export async function similaritySearch(bucketName: string, query: string, numResults = 5) {
  return telnyxRequest<{
    data: Array<{
      document_chunk?: string;
      distance?: number;
      filename?: string;
    }>;
  }>("/ai/embeddings/similarity-search", {
    method: "POST",
    body: {
      bucket_name: bucketName,
      query,
      num_docs_return: numResults,
    },
  });
}

export function retrievalToolForBuckets(bucketIds: string[], maxNumResults = 8) {
  if (!bucketIds.length) return null;
  return {
    type: "retrieval" as const,
    retrieval: {
      bucket_ids: bucketIds,
      max_num_results: maxNumResults,
    },
  };
}

/** Ensure KB has a Telnyx bucket; upload text content as a .txt object. */
export async function syncTextSourceToTelnyx(input: {
  workspaceId: string;
  knowledgeBaseId: string;
  sourceId: string;
  fileName: string;
  text: string;
  existingBucketName?: string | null;
}) {
  if (!isTelnyxRagConfigured()) {
    return { mode: "mock" as const, bucketName: null, objectKey: null, taskId: null };
  }
  const bucketName =
    input.existingBucketName ||
    knowledgeBucketName(input.workspaceId, input.knowledgeBaseId);
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const objectKey = `sources/${input.sourceId}/${safeName || "content.txt"}`;
  await uploadKnowledgeObject({
    bucketName,
    key: objectKey,
    body: input.text,
    contentType: "text/plain; charset=utf-8",
  });
  const embed = await embedBucket(bucketName);
  return {
    mode: "telnyx" as const,
    bucketName,
    objectKey,
    taskId: embed.data?.task_id || null,
  };
}

/** Upload a binary file (PDF/DOCX/CSV/TXT) and trigger bucket embed. */
export async function syncFileSourceToTelnyx(input: {
  workspaceId: string;
  knowledgeBaseId: string;
  sourceId: string;
  fileName: string;
  contentType: string;
  bytes: Buffer;
  existingBucketName?: string | null;
}) {
  if (!isTelnyxRagConfigured()) {
    return { mode: "mock" as const, bucketName: null, objectKey: null, taskId: null };
  }
  const bucketName =
    input.existingBucketName ||
    knowledgeBucketName(input.workspaceId, input.knowledgeBaseId);
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const objectKey = `sources/${input.sourceId}/${safeName || "upload.bin"}`;
  await uploadKnowledgeObject({
    bucketName,
    key: objectKey,
    body: input.bytes,
    contentType: input.contentType || "application/octet-stream",
  });
  const embed = await embedBucket(bucketName);
  return {
    mode: "telnyx" as const,
    bucketName,
    objectKey,
    taskId: embed.data?.task_id || null,
  };
}

export async function syncUrlSourceToTelnyx(input: {
  workspaceId: string;
  knowledgeBaseId: string;
  url: string;
  existingBucketName?: string | null;
}) {
  if (!isTelnyxRagConfigured()) {
    return { mode: "mock" as const, bucketName: null, taskId: null };
  }
  const bucketName =
    input.existingBucketName ||
    knowledgeBucketName(input.workspaceId, input.knowledgeBaseId);
  // Bucket must exist before URL embed.
  const { ensureKnowledgeBucket } = await import("./storage");
  await ensureKnowledgeBucket(bucketName);
  const embed = await embedUrlIntoBucket(bucketName, input.url);
  return {
    mode: "telnyx" as const,
    bucketName,
    taskId: embed.data?.task_id || null,
  };
}
