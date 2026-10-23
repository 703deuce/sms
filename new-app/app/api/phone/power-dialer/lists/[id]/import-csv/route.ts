import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { mapCsvRows, parseCsvText } from "@/lib/server/phone/power-dialer/csv-import";
import { applyCsvImportToList } from "@/lib/server/phone/power-dialer/list-import-apply";
import type { ColumnMapping } from "@/lib/server/phone/power-dialer/csv-import";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id: listId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      csvText?: string;
      mapping?: ColumnMapping;
      duplicateBehavior?: "skip" | "update" | "add_to_list";
      dryRun?: boolean;
    };
    const { headers, rows } = parseCsvText(String(body.csvText || ""));
    const mapping = body.mapping || { custom: {} };
    const parsed = mapCsvRows(rows, mapping);
    if (body.dryRun) {
      return NextResponse.json({
        data: {
          headers,
          preview: parsed.slice(0, 50),
          totalRows: parsed.length,
        },
      });
    }
    const result = await applyCsvImportToList(workspaceId, listId, parsed, {
      duplicateBehavior: body.duplicateBehavior || "add_to_list",
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
