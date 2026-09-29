#!/usr/bin/env npx tsx
/** List Supabase storage buckets (metadata only, no object bytes). */
import { getSupabaseAdmin, isSupabaseConfigured, getSupabaseUrl } from "@/lib/supabase/admin";

async function main() {
  if (!isSupabaseConfigured()) {
    console.log(JSON.stringify({ event: "supabase_storage_inventory", configured: false }));
    return;
  }
  const supabase = getSupabaseAdmin();
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error(JSON.stringify({ event: "supabase_storage_inventory", error: error.message }));
    process.exit(1);
  }
  const summary = (buckets ?? []).map((b) => ({
    name: b.name,
    public: b.public,
    createdAt: b.created_at,
    fileSizeLimit: b.file_size_limit,
  }));
  console.log(
    JSON.stringify(
      {
        event: "supabase_storage_inventory",
        projectHost: new URL(getSupabaseUrl()).hostname,
        bucketCount: summary.length,
        buckets: summary,
        note:
          "Postgres logical backups do not include Storage object bytes; use independent object backup if required.",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
