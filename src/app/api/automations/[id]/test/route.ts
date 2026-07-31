import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { enrollInAutomation } from "@/lib/automations/enroll";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as { contactId?: string };

    if (!body.contactId) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    const flow = await getPrisma().automationFlow.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await enrollInAutomation({
      workspaceId: auth.workspaceId,
      flowId: id,
      contactId: body.contactId,
      testMode: true,
    });

    return NextResponse.json({
      data: {
        executionId: result.execution?.id,
        skipped: result.skipped,
        reason: result.reason,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
