import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { countSegmentContacts } from "@/lib/contacts/segment-query";

/**
 * Preview how many contacts match a set of segment conditions.
 * Accepts either raw `conditions` or an existing `segmentId`.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      conditions?: unknown;
      segmentId?: string;
    };

    let conditions = body.conditions;
    if (body.segmentId) {
      const segment = await getPrisma().segment.findFirst({
        where: { id: body.segmentId, workspaceId: auth.workspaceId },
      });
      if (!segment) return NextResponse.json({ error: "Not found" }, { status: 404 });
      conditions = segment.conditions;
    }

    const count = await countSegmentContacts(auth.workspaceId, conditions);
    return NextResponse.json({ data: { count } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
