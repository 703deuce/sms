import { NextResponse } from "next/server";
import {
  deleteReferenceAsync,
  listReferencesAsync,
} from "@/lib/ui-agent/references-manifest-server";
import {
  createUiReferenceSignedUrl,
  deleteUiReferenceFromStorage,
  isUiReferenceStorageConfigured,
} from "@/lib/ui-agent/reference-storage";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    const refs = await listReferencesAsync();
    const withUrls = await Promise.all(
      refs.map(async ({ name, entry }) => {
        let previewUrl: string | null = null;
        if (entry.storage === "supabase" && entry.bucket) {
          try {
            previewUrl = await createUiReferenceSignedUrl({
              bucket: entry.bucket,
              path: entry.path,
              expiresInSeconds: 3600,
            });
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load references.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Video bytes must use prepare → direct Supabase upload → complete. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct multipart upload is disabled. Use /api/transovo/kimi/references/prepare and /complete with browser → Supabase upload.",
      code: "use_direct_upload",
    },
    { status: 405 },
  );
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    const removed = await deleteReferenceAsync(name);
    if (!removed) return NextResponse.json({ error: "Reference not found" }, { status: 404 });

    if (removed.storage === "supabase" && removed.bucket) {
      try {
        await deleteUiReferenceFromStorage({ bucket: removed.bucket, path: removed.path });
      } catch {
        // manifest already updated
      }
    }

    return NextResponse.json({ ok: true, name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
