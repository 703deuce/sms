import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveWorkspaceBySlug } from "@/lib/appointments";
import { handleEmailAiBooking } from "@/lib/appointments/ai-booking-orchestrator";
import { getPrisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      workspaceSlug?: string;
      workspaceId?: string;
      from?: string;
      subject?: string;
      text?: string;
      html?: string;
    };

    let workspaceId = body.workspaceId;
    if (!workspaceId && body.workspaceSlug) {
      const ws = await resolveWorkspaceBySlug(body.workspaceSlug);
      workspaceId = ws?.id;
    }
    if (!workspaceId || !body.from) {
      return NextResponse.json({ error: "workspaceId/workspaceSlug and from required" }, { status: 400 });
    }

    const email = body.from.replace(/.*<([^>]+)>.*/, "$1").trim() || body.from;
    const prisma = getPrisma();
    const contact = await prisma.contact.findFirst({
      where: { workspaceId, email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });

    const messageBody = body.text || body.html?.replace(/<[^>]+>/g, " ") || "";
    const result = await handleEmailAiBooking(
      workspaceId,
      email,
      body.subject || "",
      messageBody,
      contact?.id,
    );

    return NextResponse.json({
      data: {
        reply: result.message,
        type: result.type,
        requiresFollowUp: result.requiresFollowUp,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
