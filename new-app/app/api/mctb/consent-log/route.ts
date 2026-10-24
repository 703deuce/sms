import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { loadConsentLogRows } from "@/lib/mctb/consent-log";

export async function GET(req: Request) {
  try {
    const { workspaceId } = await requireSession();
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 100);
    const caller = searchParams.get("caller") || undefined;
    const { rows, summary } = await loadConsentLogRows(workspaceId, { limit, caller });
    return NextResponse.json({ ok: true, data: { summary, events: rows } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "consent_log_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
