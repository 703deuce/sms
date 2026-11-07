#!/usr/bin/env npx tsx
/**
 * Create all Supabase Storage buckets expected by Transovo (idempotent).
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";

type BucketSpec = {
  name: string;
  public: boolean;
  fileSizeLimit?: number;
  allowedMimeTypes?: string[];
};

const BUCKETS: BucketSpec[] = [
  {
    name: process.env.SUPABASE_VOICEMAIL_GREETINGS_BUCKET?.trim() || "voicemail-greetings",
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/webm"],
  },
  {
    name: process.env.SUPABASE_CALL_RECORDINGS_BUCKET?.trim() || "call-recordings",
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
  },
  {
    name: process.env.SUPABASE_MMS_MEDIA_BUCKET?.trim() || "mms-media",
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  },
  {
    name: process.env.SUPABASE_FAX_DOCUMENTS_BUCKET?.trim() || "fax-documents",
    public: false,
    fileSizeLimit: 25 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"],
  },
  {
    name: process.env.SUPABASE_UI_REFERENCES_BUCKET?.trim() || "ui-references",
    public: false,
    fileSizeLimit: 100 * 1024 * 1024,
  },
  {
    name: process.env.SUPABASE_VISUALIZER_BUCKET?.trim() || "visualizer-media",
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
  },
  { name: "reports", public: false, fileSizeLimit: 50 * 1024 * 1024 },
];

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: existing, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`listBuckets: ${listError.message}`);

  const names = new Set((existing ?? []).map((b) => b.name));
  const results: { name: string; action: string; error?: string }[] = [];

  for (const spec of BUCKETS) {
    if (names.has(spec.name)) {
      results.push({ name: spec.name, action: "exists" });
      continue;
    }
    const { error } = await supabase.storage.createBucket(spec.name, {
      public: spec.public,
      fileSizeLimit: spec.fileSizeLimit,
      allowedMimeTypes: spec.allowedMimeTypes,
    });
    if (error && !/already exists/i.test(error.message)) {
      results.push({ name: spec.name, action: "create_failed", error: error.message });
    } else {
      results.push({ name: spec.name, action: "created" });
      names.add(spec.name);
    }
  }

  const { data: after } = await supabase.storage.listBuckets();
  console.log(
    JSON.stringify(
      {
        event: "ensure_all_supabase_storage_buckets",
        projectHost: new URL(url).hostname,
        results,
        bucketCount: after?.length ?? 0,
        buckets: (after ?? []).map((b) => ({ name: b.name, public: b.public })),
      },
      null,
      2,
    ),
  );

  const failed = results.filter((r) => r.action === "create_failed");
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
