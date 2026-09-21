import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { jobId } = await context.params;
    const prisma = getPrisma();
    const job = await prisma.voiceWebsiteCrawlJob.findFirst({
      where: { id: jobId, workspaceId: auth.workspaceId },
      include: {
        pages: {
          orderBy: { sourceUrl: "asc" },
          take: 200,
          select: {
            id: true,
            sourceUrl: true,
            pageTitle: true,
            status: true,
            lastIndexedAt: true,
            skipReason: true,
            errorMessage: true,
          },
        },
      },
    });
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: job });
  } catch (err) {
    return jsonError(err, 500);
  }
}
