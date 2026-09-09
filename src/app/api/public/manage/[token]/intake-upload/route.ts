import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveManageAppointmentByToken } from "@/lib/appointments/service-booking";
import { uploadMmsImageToStorage } from "@/lib/mass-texting/media-storage";

type Params = { params: Promise<{ token: string }> };

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveManageAppointmentByToken(token);
    if (!resolved) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });

    const permissions = (resolved.token.permissions || {}) as Record<string, boolean>;
    if (!permissions.editIntake) {
      return NextResponse.json({ error: "Intake editing is not allowed for this link" }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File must be 5 MB or smaller" }, { status: 400 });
    }

    const uploaded = await uploadMmsImageToStorage({
      workspaceId: resolved.token.workspaceId,
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type || "application/octet-stream",
      filename: file.name,
    });

    return NextResponse.json({
      data: {
        url: uploaded.storageUrl,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
