import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_BUCKET = process.env.SUPABASE_FAX_DOCUMENTS_BUCKET?.trim() || "fax-documents";

export async function uploadFaxDocument(input: {
  workspaceId: string;
  transmissionId: string;
  bytes: Buffer;
  mimeType?: string;
  extension?: string;
}) {
  const ext = input.extension || "pdf";
  const now = new Date();
  const path = `${input.workspaceId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${input.transmissionId}/${Date.now()}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(DEFAULT_BUCKET).upload(path, input.bytes, {
    contentType: input.mimeType || "application/pdf",
    upsert: false,
  });
  if (error) throw new Error(`Fax storage upload failed: ${error.message}`);

  return { bucket: DEFAULT_BUCKET, path };
}

export async function createSignedFaxDocumentUrl(bucket: string, path: string, expiresIn = 3600) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw new Error(`Signed fax URL failed: ${error.message}`);
  return data.signedUrl;
}

export async function downloadFaxDocument(bucket: string, path: string): Promise<Buffer> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Fax download failed: ${error?.message || "empty"}`);
  return Buffer.from(await data.arrayBuffer());
}
