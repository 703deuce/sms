import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { getPowerDialerSettings } from "@/lib/server/phone/power-dialer";
import { uploadPowerDialerAudio } from "@/lib/server/storage/power-dialer-audio-storage";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const settings = await getPowerDialerSettings(workspaceId);
    if (!(settings as { prerecordedVmOptIn?: boolean }).prerecordedVmOptIn) {
      return NextResponse.json(
        { error: "Prerecorded voicemail drops are disabled until an admin enables compliance opt-in." },
        { status: 403 },
      );
    }
    const form = await request.formData();
    const file = form.get("file");
    const name = String(form.get("name") || "Voicemail drop");
    if (!(file instanceof File)) throw new Error("file required");

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadPowerDialerAudio({
      workspaceId,
      bytes,
      mimeType: file.type || "audio/mpeg",
      filename: file.name,
    });

    const prisma = getPrisma();
    const row = await prisma.powerDialerVoicemailDrop.create({
      data: {
        workspaceId,
        name,
        storageUrl: uploaded.storageUrl,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
      },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
