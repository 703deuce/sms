import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { importContactsToList } from "@/lib/server/contacts";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      listId?: string;
      rows?: { name?: string; phone: string; company?: string }[];
    };
    const data = await importContactsToList(workspaceId, String(body.listId || ""), body.rows || []);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
