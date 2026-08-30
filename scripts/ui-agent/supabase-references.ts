import { createClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = "ui-references";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function resolveUiReferencesBucket(): string {
  return process.env.SUPABASE_UI_REFERENCES_BUCKET?.trim() || DEFAULT_BUCKET;
}

export function isCliSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export async function downloadUiReferenceObject(input: { bucket: string; path: string }): Promise<Buffer> {
  const supabase = getAdmin();
  const { data, error } = await supabase.storage.from(input.bucket).download(input.path);
  if (error || !data) throw new Error(`Download failed: ${error?.message || "missing object"}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function createCliSignedUrl(input: {
  bucket: string;
  path: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const supabase = getAdmin();
  const { data, error } = await supabase.storage
    .from(input.bucket)
    .createSignedUrl(input.path, input.expiresInSeconds ?? 3600);
  if (error || !data?.signedUrl) throw new Error(`Signed URL failed: ${error?.message || "unknown"}`);
  return data.signedUrl;
}
