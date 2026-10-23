import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { ensureDefaultDispositionSet, listDispositionSets } from "@/lib/server/phone/power-dialer/dispositions";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await listDispositionSets(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { name?: string; cloneFromSetId?: string };
    const prisma = getPrisma();
    if (body.cloneFromSetId) {
      const src = await prisma.powerDialerDispositionSet.findFirst({
        where: { id: body.cloneFromSetId, workspaceId },
        include: { dispositions: true },
      });
      if (!src) throw new Error("Source set not found");
      const created = await prisma.powerDialerDispositionSet.create({
        data: {
          workspaceId,
          name: body.name || `${src.name} (copy)`,
          dispositions: {
            create: src.dispositions.map((d) => ({
              label: d.label,
              category: d.category,
              outcomeClass: d.outcomeClass,
              colorHex: d.colorHex,
              hotkey: d.hotkey,
              answerContext: d.answerContext,
              actionsJson: d.actionsJson as Prisma.InputJsonValue,
              sortOrder: d.sortOrder,
              requireNotes: d.requireNotes,
              markConnected: d.markConnected,
              markContactCompleted: d.markContactCompleted,
              scheduleCallback: d.scheduleCallback,
              removeFromQueue: d.removeFromQueue,
              addToDnc: d.addToDnc,
              triggerCrmUpdate: d.triggerCrmUpdate,
              triggerFollowUp: d.triggerFollowUp,
            })),
          },
        },
        include: { dispositions: true },
      });
      return NextResponse.json({ data: created });
    }
    await ensureDefaultDispositionSet(workspaceId);
    const set = await prisma.powerDialerDispositionSet.create({
      data: { workspaceId, name: body.name || "Custom outcomes" },
      include: { dispositions: true },
    });
    return NextResponse.json({ data: set });
  } catch (err) {
    return jsonError(err, 400);
  }
}
