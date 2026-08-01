import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  listPendingConflicts,
  resolvePendingConflict,
  type ConflictDecision,
} from "@/lib/crm/conflicts-ui";
import { humanizeCrmError } from "@/lib/crm/human-errors";
import { isCrmProvider } from "@/lib/crm/registry";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const provider = new URL(request.url).searchParams.get("provider")?.trim();
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "provider required" }, { status: 400 });
    }
    const pending = await listPendingConflicts(auth.workspaceId, provider);
    return NextResponse.json({ data: pending });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      provider?: string;
      conflictId?: string;
      decision?: ConflictDecision;
      remember?: boolean;
    };
    if (!body.provider || !isCrmProvider(body.provider)) {
      return NextResponse.json({ error: "provider required" }, { status: 400 });
    }
    if (!body.conflictId || !body.decision) {
      return NextResponse.json({ error: "conflictId and decision required" }, { status: 400 });
    }
    const allowed: ConflictDecision[] = ["use_crm", "use_transovo", "merge", "ignore"];
    if (!allowed.includes(body.decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }
    const result = await resolvePendingConflict({
      workspaceId: auth.workspaceId,
      provider: body.provider,
      conflictId: body.conflictId,
      decision: body.decision,
      remember: Boolean(body.remember),
      actorUserId: auth.session.userId,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json({ error: humanizeCrmError(err) }, { status: 400 });
  }
}
