import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { requireWorkspacePhoneAdmin } from "@/lib/phone/softphone-permissions";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    // Directory read is available to all members (transfer targets / presence helpers).
    // Mutations below require phone admin.
    const prisma = getPrisma();
    const numbers = await prisma.phoneNumber.findMany({
      where: { workspaceId: auth.workspaceId },
      select: { id: true, e164: true, status: true },
    });
    const [settings, assignments] = await Promise.all([
      prisma.softphoneUserSettings.findMany({ where: { workspaceId: auth.workspaceId } }),
      prisma.phoneNumberAssignment.findMany({
        where: { phoneNumberId: { in: numbers.map((n: { id: string }) => n.id) } },
      }),
    ]);
    const { getSoftphonePermissions } = await import("@/lib/phone/softphone-permissions");
    const perms = await getSoftphonePermissions(auth.workspaceId, auth.session.userId);
    return NextResponse.json({
      data: { settings, assignments, numbers },
      me: auth.session.userId,
      permissions: [...perms.allowed],
      mineSettings:
        settings.find((s: { userId: string }) => s.userId === auth.session.userId) || null,
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireWorkspacePhoneAdmin(auth.workspaceId, auth.session.userId);
    const body = (await request.json()) as {
      userId?: string;
      extension?: string;
      defaultCallerId?: string;
      forwardToCellular?: string;
      dndEnabled?: boolean;
      recordingEnabled?: boolean;
      internationalEnabled?: boolean;
      e911AddressJson?: Record<string, unknown>;
      permissionsJson?: Record<string, unknown>;
      ringDesktop?: boolean;
      ringMobile?: boolean;
    };
    const userId = body.userId || auth.session.userId;
    const prisma = getPrisma();
    const existing = await prisma.softphoneUserSettings.findUnique({
      where: { workspaceId_userId: { workspaceId: auth.workspaceId, userId } },
    });
    const mergedPerms = body.permissionsJson
      ? {
          ...((existing?.permissionsJson as object) || {}),
          ...body.permissionsJson,
        }
      : existing?.permissionsJson;
    const row = await prisma.softphoneUserSettings.upsert({
      where: {
        workspaceId_userId: { workspaceId: auth.workspaceId, userId },
      },
      create: {
        workspaceId: auth.workspaceId,
        userId,
        extension: body.extension,
        defaultCallerId: body.defaultCallerId,
        forwardToCellular: body.forwardToCellular,
        dndEnabled: body.dndEnabled ?? false,
        recordingEnabled: body.recordingEnabled ?? true,
        internationalEnabled: body.internationalEnabled ?? false,
        e911AddressJson: body.e911AddressJson as object | undefined,
        permissionsJson: (mergedPerms as object) || undefined,
        ringDesktop: body.ringDesktop ?? true,
        ringMobile: body.ringMobile ?? true,
      },
      update: {
        extension: body.extension,
        defaultCallerId: body.defaultCallerId,
        forwardToCellular: body.forwardToCellular,
        dndEnabled: body.dndEnabled,
        recordingEnabled: body.recordingEnabled,
        internationalEnabled: body.internationalEnabled,
        e911AddressJson: body.e911AddressJson as object | undefined,
        permissionsJson: mergedPerms as object | undefined,
        ringDesktop: body.ringDesktop,
        ringMobile: body.ringMobile,
      },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
