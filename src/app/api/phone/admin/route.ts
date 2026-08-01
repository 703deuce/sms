import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
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
    return NextResponse.json({ data: { settings, assignments, numbers } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
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
    const row = await getPrisma().softphoneUserSettings.upsert({
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
        permissionsJson: body.permissionsJson as object | undefined,
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
        permissionsJson: body.permissionsJson as object | undefined,
        ringDesktop: body.ringDesktop,
        ringMobile: body.ringMobile,
      },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
