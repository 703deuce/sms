import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { listWorkspaceContacts } from "@/lib/server/contacts";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 50);
    const data = await listWorkspaceContacts(workspaceId, { q, page, pageSize });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
