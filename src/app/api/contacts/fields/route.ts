import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  parseCustomFieldsConfig,
  validateCustomFieldsPayload,
  type CustomFieldDefinition,
} from "@/lib/contacts/custom-fields";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const workspace = await getPrisma().workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { customFieldsConfig: true },
    });
    const fields = parseCustomFieldsConfig(workspace?.customFieldsConfig);
    return NextResponse.json({ data: { fields } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { fields?: CustomFieldDefinition[] };
    if (!Array.isArray(body.fields)) {
      return NextResponse.json({ error: "fields array required" }, { status: 400 });
    }
    const fields = validateCustomFieldsPayload(body.fields);
    const workspace = await getPrisma().workspace.update({
      where: { id: auth.workspaceId },
      data: { customFieldsConfig: fields },
      select: { customFieldsConfig: true },
    });
    return NextResponse.json({
      data: { fields: parseCustomFieldsConfig(workspace.customFieldsConfig) },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
