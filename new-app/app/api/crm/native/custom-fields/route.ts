import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { listCustomFieldDefinitions, upsertCustomFieldDefinition } from "@/lib/server/crm/native/custom-fields";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await listCustomFieldDefinitions(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = await request.json();
    if (!body.key?.trim() || !body.label?.trim() || !body.fieldType) {
      return NextResponse.json({ error: "key, label, fieldType required" }, { status: 400 });
    }
    const data = await upsertCustomFieldDefinition(workspaceId, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
