import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { findDuplicateContactGroups } from "@/lib/server/crm/native/contacts-admin";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await findDuplicateContactGroups(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
