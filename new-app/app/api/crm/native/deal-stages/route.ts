import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { ensureDefaultDealStages, upsertDealStages } from "@/lib/server/crm/native/deals";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await ensureDefaultDealStages(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PUT(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { stages?: unknown[] };
    const stages = (body.stages || []) as {
      id?: string;
      name: string;
      sortOrder: number;
      isClosedWon?: boolean;
      isClosedLost?: boolean;
    }[];
    const data = await upsertDealStages(workspaceId, stages);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
