import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const prisma = getPrisma();
    const contest = await prisma.contest.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!contest) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const entries = await prisma.contestEntry.findMany({
      where: { contestId: contest.id },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    // Resolve winner contact display info.
    let winners: Array<{ id: string; name: string; phone: string }> = [];
    if (contest.winnerContactIds.length) {
      const contacts = await prisma.contact.findMany({
        where: { id: { in: contest.winnerContactIds }, workspaceId: auth.workspaceId },
      });
      winners = (contacts as Array<{ id: string; firstName: string | null; lastName: string | null; phone: string }>).map((c) => ({
        id: c.id,
        name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.phone,
        phone: c.phone,
      }));
    }

    return NextResponse.json({
      data: {
        contest,
        entries,
        winners,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      keywordText?: string;
      startAt?: string | null;
      endAt?: string | null;
      maxEntries?: number | null;
      winnerCount?: number;
      rulesText?: string | null;
      prizeDescription?: string | null;
      status?: string;
    };

    const prisma = getPrisma();
    const existing = await prisma.contest.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.keywordText !== undefined) data.keywordText = body.keywordText.trim().toUpperCase();
    if (body.startAt !== undefined) data.startAt = body.startAt ? new Date(body.startAt) : null;
    if (body.endAt !== undefined) data.endAt = body.endAt ? new Date(body.endAt) : null;
    if (body.maxEntries !== undefined)
      data.maxEntries = body.maxEntries == null ? null : Number(body.maxEntries);
    if (body.winnerCount !== undefined) data.winnerCount = Math.max(1, Number(body.winnerCount));
    if (body.rulesText !== undefined) data.rulesText = body.rulesText?.trim() || null;
    if (body.prizeDescription !== undefined)
      data.prizeDescription = body.prizeDescription?.trim() || null;
    if (body.status !== undefined && ["draft", "active", "paused", "ended"].includes(body.status)) {
      data.status = body.status;
    }

    const row = await prisma.contest.update({ where: { id: existing.id }, data });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const prisma = getPrisma();
    const existing = await prisma.contest.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.contest.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
