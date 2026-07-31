import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { requireVoicePermission } from "@/lib/voice/permissions";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const profile = await getPrisma().voiceComplianceProfile.findUnique({
      where: { workspaceId: auth.workspaceId },
    });
    return NextResponse.json({
      data: profile?.settings || {},
      emergencyStop: profile?.emergencyStop ?? false,
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireVoicePermission(auth.session.userId, auth.workspaceId, "compliance_settings");
    const body = (await request.json()) as {
      emergencyStop?: boolean;
      settings?: Record<string, unknown>;
    };
    const row = await getPrisma().voiceComplianceProfile.upsert({
      where: { workspaceId: auth.workspaceId },
      create: {
        workspaceId: auth.workspaceId,
        emergencyStop: body.emergencyStop ?? false,
        settings: body.settings || {},
      },
      update: {
        emergencyStop: body.emergencyStop ?? undefined,
        settings: body.settings as object | undefined,
      },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
