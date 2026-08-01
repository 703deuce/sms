import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { isCrmProvider } from "@/lib/crm/registry";
import { listFieldMappings, upsertFieldMapping } from "@/lib/crm/mappings";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const provider = new URL(request.url).searchParams.get("provider");
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "provider required" }, { status: 400 });
    }
    const [fields, objects] = await Promise.all([
      listFieldMappings(auth.workspaceId, provider),
      getPrisma().crmObjectMapping.findMany({
        where: { workspaceId: auth.workspaceId, provider },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
    ]);
    return NextResponse.json({ data: { fields, objects } });
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
      objectType?: string;
      internalField?: string;
      externalField?: string;
      transform?: string | null;
      direction?: string;
    };
    if (!body.provider || !isCrmProvider(body.provider)) {
      return NextResponse.json({ error: "provider required" }, { status: 400 });
    }
    if (!body.objectType || !body.internalField || !body.externalField) {
      return NextResponse.json({ error: "objectType, internalField, externalField required" }, { status: 400 });
    }
    const row = await upsertFieldMapping({
      workspaceId: auth.workspaceId,
      provider: body.provider,
      objectType: body.objectType,
      internalField: body.internalField,
      externalField: body.externalField,
      transform: body.transform,
      direction: body.direction,
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
