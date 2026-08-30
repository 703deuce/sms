import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { kimiMaxBytesForMime } from "@/lib/ui-agent/reference-limits";
import { createUiReferenceSignedUpload, isUiReferenceStorageConfigured } from "@/lib/ui-agent/reference-storage";

export const runtime = "nodejs";
export const maxDuration = 60;

type PrepareBody = {
  name?: string;
  mimeType?: string;
  size?: number;
  filename?: string;
};

export async function POST(request: Request) {
  if (!isUiReferenceStorageConfigured()) {
    return NextResponse.json({ error: "Supabase storage is not configured." }, { status: 503 });
  }

  let body: PrepareBody;
  try {
    body = (await request.json()) as PrepareBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const mimeType = String(body.mimeType || "").toLowerCase();
  const size = Number(body.size || 0);
  const filename = String(body.filename || "").trim();

  if (!name || !/^[a-z0-9][a-z0-9-_]*$/i.test(name)) {
    return NextResponse.json({ error: "Name must be alphanumeric with dashes/underscores." }, { status: 400 });
  }
  if (!mimeType) {
    return NextResponse.json({ error: "mimeType is required." }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "File size is required." }, { status: 400 });
  }

  const kind = mimeType.startsWith("video/") ? "video" : mimeType.startsWith("image/") ? "image" : null;
  if (!kind) {
    return NextResponse.json({ error: "Upload a video (mp4/mov/webm) or image (png/jpg/webp)." }, { status: 400 });
  }

  const maxBytes = kimiMaxBytesForMime(mimeType);
  if (size > maxBytes) {
    return NextResponse.json(
      { error: `File is too large. Max ${kind === "video" ? "100 MB" : "20 MB"} for ${kind}s.` },
      { status: 400 },
    );
  }

  try {
    const signed = await createUiReferenceSignedUpload({
      name,
      kind,
      mimeType,
      filename: filename || undefined,
    });

    return NextResponse.json({
      uploadId: randomUUID(),
      bucket: signed.bucket,
      path: signed.path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      kind,
      mimeType,
      size,
      filename: filename || null,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
