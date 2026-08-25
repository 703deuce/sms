import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import type { VerifyBulkJobRow } from "@prisma/client";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const prisma = getPrisma();
    const job = await prisma.verifyBulkJob.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!job) return jsonError(new Error("Job not found"), 404);

    const rows = await prisma.verifyBulkJobRow.findMany({
      where: { bulkJobId: id, workspaceId: auth.workspaceId },
      orderBy: { rowIndex: "asc" },
      take: 200,
    });

    const lookupIds = rows.map((r: VerifyBulkJobRow) => r.lookupId).filter(Boolean) as string[];
    const lookups = lookupIds.length
      ? await prisma.verifyLookup.findMany({ where: { id: { in: lookupIds } } })
      : [];

    return NextResponse.json({ data: { job, rows, lookups } });
  } catch (err) {
    return jsonError(err);
  }
}
