import "server-only";

import { getPrisma } from "@/lib/db";
import { buildEnrichedCsv } from "./csv";
import type { VerifyBulkJobRow, VerifyLookup } from "@prisma/client";

type JobRow = VerifyBulkJobRow & { lookup?: VerifyLookup | null };

export async function exportBulkVerifyJobCsv(
  workspaceId: string,
  jobId: string,
  filter?: string,
): Promise<string> {
  const prisma = getPrisma();
  const job = await prisma.verifyBulkJob.findFirst({
    where: { id: jobId, workspaceId },
  });
  if (!job) throw new Error("JOB_NOT_FOUND");

  const rows = await prisma.verifyBulkJobRow.findMany({
    where: { bulkJobId: jobId, workspaceId },
    orderBy: { rowIndex: "asc" },
  });

  const lookupIds = rows.map((r: VerifyBulkJobRow) => r.lookupId).filter(Boolean) as string[];
  const lookups = lookupIds.length
    ? await prisma.verifyLookup.findMany({ where: { id: { in: lookupIds } } })
    : [];
  const lookupById = new Map(lookups.map((l: VerifyLookup) => [l.id, l]));

  const headers =
    rows.length > 0
      ? Object.keys((rows[0].originalDataJson as Record<string, string>) || {})
      : ["phone"];

  const objects = rows.map((row: VerifyBulkJobRow) => {
    const base = (row.originalDataJson || {}) as Record<string, string>;
    const lookup = row.lookupId ? lookupById.get(row.lookupId) : null;
    return { row, base, lookup };
  });

  const filtered = objects.filter(({ lookup, row }: { lookup?: VerifyLookup | null; row: VerifyBulkJobRow }) => {
    if (!filter || filter === "all") return true;
    const line = String(lookup?.lineType || "").toLowerCase();
    const status = String(lookup?.lookupStatus || row.status).toLowerCase();
    if (filter === "mobile") return line.includes("mobile");
    if (filter === "landline") return line.includes("landline");
    if (filter === "voip") return line.includes("voip");
    if (filter === "toll-free") return line.includes("toll");
    if (filter === "invalid") return status === "invalid_format";
    if (filter === "unknown") return !line || line === "unknown";
    if (filter === "error") return status === "provider_error" || row.status === "failed";
    return true;
  });

  return buildEnrichedCsv(
    headers,
    filtered.map((f: { base: Record<string, string> }) => f.base),
    (rowObj: Record<string, string>) => {
      const match = filtered.find((f: { base: Record<string, string> }) =>
        headers.every((h) => String(f.base[h] ?? "") === String(rowObj[h] ?? "")),
      );
      const lookup = match?.lookup;
      return {
        transovo_normalized_phone: lookup?.normalizedE164 || "",
        transovo_line_type: lookup?.lineType || "",
        transovo_carrier: lookup?.carrier || "",
        transovo_country: lookup?.country || "",
        transovo_ported: lookup?.ported || "",
        transovo_lookup_status: lookup?.lookupStatus || match?.row.status || "",
      };
    },
  );
}
