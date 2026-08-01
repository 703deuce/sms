import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  getSoftphonePermissions,
  requireWorkspacePhoneAdmin,
} from "@/lib/phone/softphone-permissions";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const numbers = await prisma.phoneNumber.findMany({
      where: { workspaceId: auth.workspaceId },
      select: { id: true, e164: true, status: true },
    });
    const [settings, assignments, members] = await Promise.all([
      prisma.softphoneUserSettings.findMany({ where: { workspaceId: auth.workspaceId } }),
      prisma.phoneNumberAssignment.findMany({
        where: { phoneNumberId: { in: numbers.map((n: { id: string }) => n.id) } },
      }),
      prisma.membership.findMany({
        where: { workspaceId: auth.workspaceId },
        select: { userId: true, role: true },
      }),
    ]);
    const perms = await getSoftphonePermissions(auth.workspaceId, auth.session.userId);
    return NextResponse.json({
      data: { settings, assignments, numbers, members },
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
    const body = (await request.json()) as {
      userId?: string;
      extension?: string;
      defaultCallerId?: string;
      forwardToCellular?: string | null;
      dndEnabled?: boolean;
      recordingEnabled?: boolean;
      internationalEnabled?: boolean;
      e911AddressJson?: Record<string, unknown>;
      permissionsJson?: Record<string, unknown>;
      screening?: boolean;
      ringDesktop?: boolean;
      ringMobile?: boolean;
    };
    const targetUserId = body.userId || auth.session.userId;
    const editingOther = targetUserId !== auth.session.userId;
    const fullAclPatch = Boolean(body.permissionsJson);

    // Editing another user or full ACL matrix requires phone admin.
    // Agents may update their own cellular / ring / screening / DND without admin.
    if (editingOther || fullAclPatch) {
      await requireWorkspacePhoneAdmin(auth.workspaceId, auth.session.userId);
    }

    const prisma = getPrisma();
    const existing = await prisma.softphoneUserSettings.findUnique({
      where: { workspaceId_userId: { workspaceId: auth.workspaceId, userId: targetUserId } },
    });

    let mergedPerms = existing?.permissionsJson as Record<string, unknown> | null | undefined;
    if (body.permissionsJson) {
      mergedPerms = {
        ...((existing?.permissionsJson as object) || {}),
        ...body.permissionsJson,
      };
    } else if (typeof body.screening === "boolean") {
      mergedPerms = {
        ...((existing?.permissionsJson as object) || {}),
        screening: body.screening,
      };
    }

    const row = await prisma.softphoneUserSettings.upsert({
      where: {
        workspaceId_userId: { workspaceId: auth.workspaceId, userId: targetUserId },
      },
      create: {
        workspaceId: auth.workspaceId,
        userId: targetUserId,
        extension: body.extension,
        defaultCallerId: body.defaultCallerId,
        forwardToCellular: body.forwardToCellular ?? undefined,
        dndEnabled: body.dndEnabled ?? false,
        recordingEnabled: body.recordingEnabled ?? true,
        internationalEnabled: body.internationalEnabled ?? false,
        e911AddressJson: body.e911AddressJson as object | undefined,
        permissionsJson: (mergedPerms as object) || undefined,
        ringDesktop: body.ringDesktop ?? true,
        ringMobile: body.ringMobile ?? true,
      },
      update: {
        ...(body.extension !== undefined ? { extension: body.extension } : {}),
        ...(body.defaultCallerId !== undefined ? { defaultCallerId: body.defaultCallerId } : {}),
        ...(body.forwardToCellular !== undefined
          ? { forwardToCellular: body.forwardToCellular }
          : {}),
        ...(body.dndEnabled !== undefined ? { dndEnabled: body.dndEnabled } : {}),
        ...(body.recordingEnabled !== undefined
          ? { recordingEnabled: body.recordingEnabled }
          : {}),
        ...(body.internationalEnabled !== undefined
          ? { internationalEnabled: body.internationalEnabled }
          : {}),
        ...(body.e911AddressJson !== undefined
          ? { e911AddressJson: body.e911AddressJson as object }
          : {}),
        ...(mergedPerms !== undefined &&
        (body.permissionsJson || typeof body.screening === "boolean")
          ? { permissionsJson: mergedPerms as object }
          : {}),
        ...(body.ringDesktop !== undefined ? { ringDesktop: body.ringDesktop } : {}),
        ...(body.ringMobile !== undefined ? { ringMobile: body.ringMobile } : {}),
      },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
