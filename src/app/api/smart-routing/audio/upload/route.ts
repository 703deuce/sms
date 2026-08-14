import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { saveUploadedAudio } from "@/lib/smart-routing/media-service";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const form = await request.formData();
    const file = form.get("file");
    const name = String(form.get("name") ?? "Uploaded greeting").trim();
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "audio/mpeg";
    const asset = await saveUploadedAudio({
      workspaceId: auth.workspaceId,
      name,
      buffer,
      mimeType,
    });
    return NextResponse.json({ data: asset }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
