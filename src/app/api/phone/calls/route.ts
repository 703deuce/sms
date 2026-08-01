import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { dialCallMyPhoneBridge, dialHumanCall } from "@/lib/phone/human-call-service";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
    const direction = url.searchParams.get("direction");
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.trim();

    const where: Record<string, unknown> = { workspaceId: auth.workspaceId };
    if (direction) where.direction = direction;
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { from: { contains: q, mode: "insensitive" } },
        { to: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { disposition: { contains: q, mode: "insensitive" } },
      ];
    }

    const rows = await getPrisma().humanCall.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      to?: string;
      from?: string;
      callMyPhone?: string;
    };
    if (!body.to?.trim()) {
      return NextResponse.json({ error: "to is required" }, { status: 400 });
    }

    if (body.callMyPhone?.trim()) {
      const result = await dialCallMyPhoneBridge({
        workspaceId: auth.workspaceId,
        agentUserId: auth.session.userId,
        agentPhone: body.callMyPhone.trim(),
        destination: body.to.trim(),
        from: body.from,
      });
      return NextResponse.json(
        { data: result.call, mode: result.mode, bridge: true },
        { status: 201 },
      );
    }

    const result = await dialHumanCall({
      workspaceId: auth.workspaceId,
      agentUserId: auth.session.userId,
      to: body.to.trim(),
      from: body.from,
    });

    return NextResponse.json({ data: result.call, mode: result.mode }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
