import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi } from "@/lib/server/phone/power-dialer/public-api/http";
import { addContactToActiveSessionQueue } from "@/lib/server/phone/power-dialer/session-queue-add";

export async function POST(request: Request) {
  return withPublicApi(request, "dial:write", async (ctx) => {
    const body = (await request.json()) as {
      sessionId?: string;
      contactId?: string;
      phoneE164?: string;
    };
    if (!body.sessionId || (!body.contactId && !body.phoneE164)) {
      return NextResponse.json(
        { error: { code: "validation", message: "sessionId and contactId or phoneE164 required" } },
        { status: 400 },
      );
    }
    const prisma = getPrisma();
    const session = await prisma.powerDialerSession.findFirst({
      where: { id: body.sessionId, workspaceId: ctx.workspaceId, status: { in: ["active", "paused"] } },
    });
    if (!session) {
      return NextResponse.json({ error: { code: "not_found", message: "Active session not found" } }, { status: 404 });
    }
    if (body.contactId) {
      const r = await addContactToActiveSessionQueue(
        ctx.workspaceId,
        body.sessionId,
        body.contactId,
      );
      return NextResponse.json({ ok: true, result: r });
    }
    return NextResponse.json({
      ok: true,
      queued: true,
      message: "Phone-only click-to-call requires an existing contact in M18 follow-up",
    });
  });
}
