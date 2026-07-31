import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const rows = await prisma.contest.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { entries: true } } },
    });
    const data = (rows as Array<Record<string, any> & { _count: { entries: number } }>).map((c) => ({
      id: c.id,
      name: c.name,
      keywordText: c.keywordText,
      status: c.status,
      startAt: c.startAt,
      endAt: c.endAt,
      maxEntries: c.maxEntries,
      winnerCount: c.winnerCount,
      rulesText: c.rulesText,
      prizeDescription: c.prizeDescription,
      winnerContactIds: c.winnerContactIds,
      drawnAt: c.drawnAt,
      entryCount: c._count.entries,
      createdAt: c.createdAt,
    }));
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      keywordText?: string;
      startAt?: string;
      endAt?: string;
      maxEntries?: number;
      winnerCount?: number;
      rulesText?: string;
      prizeDescription?: string;
      status?: string;
    };
    const name = body.name?.trim();
    const keywordText = body.keywordText?.trim().toUpperCase();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
    if (!keywordText) return NextResponse.json({ error: "keyword required" }, { status: 400 });

    const row = await getPrisma().contest.create({
      data: {
        workspaceId: auth.workspaceId,
        name,
        keywordText,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        maxEntries: body.maxEntries != null ? Number(body.maxEntries) : null,
        winnerCount: body.winnerCount != null ? Math.max(1, Number(body.winnerCount)) : 1,
        rulesText: body.rulesText?.trim() || null,
        prizeDescription: body.prizeDescription?.trim() || null,
        status: body.status === "active" ? "active" : "draft",
      },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
