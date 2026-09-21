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
    const hook = await prisma.webhook.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!hook) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const rows = await prisma.voiceWebhookDelivery.findMany({
      where: { webhookId: id, workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({
      data: rows.map((r: (typeof rows)[number]) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        attemptedAt: r.attemptedAt?.toISOString() ?? null,
        nextRetryAt: r.nextRetryAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
