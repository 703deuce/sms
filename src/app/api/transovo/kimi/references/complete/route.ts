import { NextResponse } from "next/server";
import { upsertReferenceAsync } from "@/lib/ui-agent/references-manifest-server";
import {
  createUiReferenceSignedUrl,
  isUiReferenceStorageConfigured,
  verifyUiReferenceObjectExists,
} from "@/lib/ui-agent/reference-storage";

export const runtime = "nodejs";
export const maxDuration = 60;

type CompleteBody = {
  uploadId?: string;
  name?: string;
  description?: string;
  bucket?: string;
  path?: string;
  kind?: "video" | "image";
  mimeType?: string;
  size?: number;
  filename?: string;
};

export async function POST(request: Request) {
  if (!isUiReferenceStorageConfigured()) {
    return NextResponse.json({ error: "Supabase storage is not configured." }, { status: 503 });
  }

  let body: CompleteBody;
  try {
    body = (await request.json()) as CompleteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const bucket = String(body.bucket || "").trim();
  const path = String(body.path || "").trim();
  const kind = body.kind;
  const mimeType = String(body.mimeType || "").trim();
  const size = Number(body.size || 0);
  const filename = String(body.filename || "").trim();
  const uploadId = String(body.uploadId || "").trim();

  if (!name || !bucket || !path || (kind !== "video" && kind !== "image")) {
    return NextResponse.json({ error: "name, bucket, path, and kind are required." }, { status: 400 });
  }

  try {
    const exists = await verifyUiReferenceObjectExists({ bucket, path });
    if (!exists) {
      return NextResponse.json(
        { error: "Uploaded file was not found in storage. Retry the upload.", code: "storage_missing" },
        { status: 409 },
      );
    }

    const entry = await upsertReferenceAsync(name, {
      type: kind,
      storage: "supabase",
      bucket,
      path,
      description: description || undefined,
    });

    let previewUrl: string | null = null;
    try {
      previewUrl = await createUiReferenceSignedUrl({ bucket, path });
    } catch {
      previewUrl = null;
    }

    return NextResponse.json({
      name,
      entry,
      previewUrl,
      uploadId: uploadId || null,
      verified: true,
      mimeType: mimeType || null,
      size: Number.isFinite(size) && size > 0 ? size : null,
      filename: filename || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save reference.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
