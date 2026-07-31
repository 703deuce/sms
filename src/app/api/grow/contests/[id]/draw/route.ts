import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

/** Draw random winners from a contest's entries. */
export async function POST(
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
    });
    if (entries.length === 0) {
      return NextResponse.json({ error: "No entries to draw from" }, { status: 400 });
    }

    // Fisher-Yates shuffle, then take winnerCount unique entries.
    const shuffled = [...entries];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const count = Math.min(Math.max(1, contest.winnerCount), shuffled.length);
    const drawn = shuffled.slice(0, count);

    // Resolve contactIds — fall back to matching by phone when entry lacks one.
    const winnerContactIds: string[] = [];
    for (const entry of drawn) {
      if (entry.contactId) {
        winnerContactIds.push(entry.contactId);
        continue;
      }
      const contact = await prisma.contact.findUnique({
        where: { workspaceId_phone: { workspaceId: auth.workspaceId, phone: entry.phone } },
      });
      if (contact) {
        winnerContactIds.push(contact.id);
      }
    }

    const updated = await prisma.contest.update({
      where: { id: contest.id },
      data: {
        winnerContactIds,
        drawnAt: new Date(),
        status: "ended",
      },
    });

    const winners = drawn.map((e) => ({ phone: e.phone, contactId: e.contactId }));
    return NextResponse.json({ data: { contest: updated, winners } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
