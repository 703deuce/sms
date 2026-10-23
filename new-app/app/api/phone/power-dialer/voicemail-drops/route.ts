import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { getPowerDialerSettings } from "@/lib/server/phone/power-dialer";
import { resolveWorkspaceId } from "@/lib/server/workspace";

const MAX_BYTES = 5 * 1024 * 1024;

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const settings = await getPowerDialerSettings(workspaceId);
    const data = await prisma.powerDialerVoicemailDrop.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({
      data,
      compliance: {
        prerecordedOptIn: Boolean((settings as { prerecordedVmOptIn?: boolean }).prerecordedVmOptIn),
        notice:
          "Prerecorded voicemail drops may be subject to federal/state telemarketing rules. Enable only after counsel review.",
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

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
    const body = (await request.json()) as {
      name?: string;
      storageUrl?: string;
      mimeType?: string;
      sizeBytes?: number;
    };
    if (!body.storageUrl) throw new Error("storageUrl required");
    if ((body.sizeBytes ?? 0) > MAX_BYTES) throw new Error("File too large (max 5MB)");
    const prisma = getPrisma();
    const row = await prisma.powerDialerVoicemailDrop.create({
      data: {
        workspaceId,
        name: body.name || "Voicemail drop",
        storageUrl: body.storageUrl,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes ?? 0,
      },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
