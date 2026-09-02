import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { assertInboxEnabled } from "@/lib/inbox/inbox-access";

/** Rename or remove a tag name on all conversations in the workspace. */
export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertInboxEnabled(auth.workspaceId);

    const body = (await request.json()) as {
      rename?: { from: string; to: string };
      remove?: string;
    };

    const prisma = getPrisma();

    if (body.rename?.from && body.rename?.to && body.rename.from !== body.rename.to) {
      const from = body.rename.from.trim();
      const to = body.rename.to.trim();
      const rows = await prisma.conversation.findMany({
        where: { workspaceId: auth.workspaceId, tags: { has: from } },
        select: { id: true, tags: true },
      });
      await Promise.all(
        rows.map((row: { id: string; tags: string[] }) =>
          prisma.conversation.update({
            where: { id: row.id },
            data: {
              tags: Array.from(
                new Set(row.tags.map((t: string) => (t === from ? to : t)).filter(Boolean)),
              ),
            },
          }),
        ),
      );
      return NextResponse.json({ ok: true, updated: rows.length });
    }

    if (body.remove?.trim()) {
      const name = body.remove.trim();
      const rows = await prisma.conversation.findMany({
        where: { workspaceId: auth.workspaceId, tags: { has: name } },
        select: { id: true, tags: true },
      });
      await Promise.all(
        rows.map((row: { id: string; tags: string[] }) =>
          prisma.conversation.update({
            where: { id: row.id },
            data: { tags: row.tags.filter((t: string) => t !== name) },
          }),
        ),
      );
      return NextResponse.json({ ok: true, updated: rows.length });
    }

    return NextResponse.json({ error: "rename or remove required" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
