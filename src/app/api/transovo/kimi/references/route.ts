import { NextResponse } from "next/server";
import { deleteReference, listReferences, upsertReference } from "@/lib/ui-agent/references-manifest";
import {
  createUiReferenceSignedUrl,
  deleteUiReferenceFromStorage,
  isUiReferenceStorageConfigured,
  uploadUiReferenceToStorage,
} from "@/lib/ui-agent/reference-storage";

export const runtime = "nodejs";

export async function GET() {
  const refs = listReferences();
  const withUrls = await Promise.all(
    refs.map(async ({ name, entry }) => {
      let previewUrl: string | null = null;
      if (entry.storage === "supabase" && entry.bucket) {
        try {
          previewUrl = await createUiReferenceSignedUrl({ bucket: entry.bucket, path: entry.path, expiresInSeconds: 3600 });
        } catch {
          previewUrl = null;
        }
      }
      return { name, entry, previewUrl };
    }),
  );

  return NextResponse.json({
    configured: isUiReferenceStorageConfigured(),
    references: withUrls,
  });
}

export async function POST(request: Request) {
  if (!isUiReferenceStorageConfigured()) {
    return NextResponse.json({ error: "Supabase storage is not configured." }, { status: 503 });
  }

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const description = String(form.get("description") || "").trim();
  const file = form.get("file");

  if (!name || !/^[a-z0-9][a-z0-9-_]*$/i.test(name)) {
    return NextResponse.json({ error: "Name must be alphanumeric with dashes/underscores." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  const kind = mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "image" : null;
  if (!kind) {
    return NextResponse.json({ error: "Upload a video (mp4/mov/webm) or image (png/jpg/webp)." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadUiReferenceToStorage({
    name,
    kind,
    bytes,
    mimeType: mime,
    filename: file.name,
  });

  const entry = upsertReference(name, {
    type: kind,
    storage: "supabase",
    bucket: uploaded.bucket,
    path: uploaded.path,
    description: description || undefined,
  });

  let previewUrl: string | null = null;
  try {
    previewUrl = await createUiReferenceSignedUrl({ bucket: uploaded.bucket, path: uploaded.path });
  } catch {
    previewUrl = null;
  }

  return NextResponse.json({ name, entry, previewUrl });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const removed = deleteReference(name);
  if (!removed) return NextResponse.json({ error: "Reference not found" }, { status: 404 });

  if (removed.storage === "supabase" && removed.bucket) {
    try {
      await deleteUiReferenceFromStorage({ bucket: removed.bucket, path: removed.path });
    } catch {
      // manifest already updated
    }
  }

  return NextResponse.json({ ok: true, name });
}
