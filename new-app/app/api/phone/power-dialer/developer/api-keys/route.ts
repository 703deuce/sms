import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { requirePowerDialerScope } from "@/lib/server/phone/power-dialer/power-dialer-permissions";
import {
  createPowerDialerApiKey,
  revokePowerDialerApiKey,
  rotatePowerDialerApiKey,
} from "@/lib/server/phone/power-dialer/public-api/api-keys";
import type { PowerDialerApiScope } from "@/lib/server/phone/power-dialer/public-api/scopes";
import { getPrisma } from "@/lib/server/db";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    await requirePowerDialerScope(workspaceId, await resolveInternalUserId(), "settings_write");
    const prisma = getPrisma();
    const rows = await prisma.powerDialerApiKey.findMany({
      where: { workspaceId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        rateLimitPerMinute: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 403);
  }
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    await requirePowerDialerScope(workspaceId, userId, "settings_write");
    const body = (await request.json()) as {
      action?: string;
      name?: string;
      scopes?: PowerDialerApiScope[];
      rateLimitPerMinute?: number;
      id?: string;
    };
    if (body.action === "revoke" && body.id) {
      await revokePowerDialerApiKey(workspaceId, body.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "rotate" && body.id) {
      const { secret } = await rotatePowerDialerApiKey(workspaceId, body.id);
      return NextResponse.json({ data: { secret } });
    }
    const { row, secret } = await createPowerDialerApiKey({
      workspaceId,
      name: body.name || "API key",
      scopes: body.scopes?.length ? body.scopes : ["contacts:read", "lists:read"],
      rateLimitPerMinute: body.rateLimitPerMinute,
      createdByUserId: userId,
    });
    return NextResponse.json({
      data: { id: row.id, prefix: row.prefix, scopes: row.scopes, secret },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
