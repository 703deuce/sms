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

/** Fetch object bytes for Kimi upload — no local disk persistence. */
export async function fetchUiReferenceBytes(input: { bucket: string; path: string }): Promise<Buffer> {
  return downloadUiReferenceObject(input);
}

export async function getUiReferenceObjectSize(input: { bucket: string; path: string }): Promise<number> {
  const supabase = getAdmin();
  const folder = input.path.includes("/") ? input.path.slice(0, input.path.lastIndexOf("/")) : "";
  const filename = input.path.split("/").pop() || input.path;
  const { data, error } = await supabase.storage.from(input.bucket).list(folder, {
    limit: 200,
    search: filename.slice(0, 40),
  });
  if (error) throw new Error(`List failed: ${error.message}`);
  const match = (data || []).find((row) => row.name === filename);
  if (!match?.metadata?.size && match?.metadata?.size !== 0) {
    const bytes = await downloadUiReferenceObject(input);
    return bytes.length;
  }
  return Number(match.metadata.size);
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
