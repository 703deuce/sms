import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { uploadMmsImageToStorage } from "@/lib/mass-texting/media-storage";
import { MASS_TEXT_MMS_MAX_BYTES } from "@/lib/mass-texting/mms";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (file.size > MASS_TEXT_MMS_MAX_BYTES) {
      return NextResponse.json(
        { error: "Images must be 1.5 MB or smaller for MMS." },
        { status: 400 },
      );
    }

    const uploaded = await uploadMmsImageToStorage({
      workspaceId: auth.workspaceId,
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type || "image/jpeg",
      filename: file.name,
    });
    const name = String(form.get("name") || file.name || "MMS image").trim();
    const row = await getPrisma().mediaAsset.create({
      data: {
        workspaceId: auth.workspaceId,
        name,
        storageUrl: uploaded.storageUrl,
        assetType: "image",
        mimeType: file.type || "image/jpeg",
        sizeBytes: file.size,
        createdBy: auth.session.email,
      },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
