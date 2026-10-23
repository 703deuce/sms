import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { listNativeContacts } from "@/lib/server/crm/native/contacts-admin";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const data = await listNativeContacts(workspaceId, {
      q: url.searchParams.get("q") || undefined,
      page: Number(url.searchParams.get("page") || 1),
      pageSize: Number(url.searchParams.get("pageSize") || 50),
      folderId: url.searchParams.get("folderId") || undefined,
      ownerUserId: url.searchParams.get("ownerUserId") || undefined,
      viewId: url.searchParams.get("viewId") || undefined,
      tagId: url.searchParams.get("tagId") || undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
