import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { createCompany, listCompanies } from "@/lib/server/crm/native/companies";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const q = new URL(request.url).searchParams.get("q") || undefined;
    const data = await listCompanies(workspaceId, q);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { name?: string; website?: string; phone?: string; notes?: string };
    if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
    const data = await createCompany(workspaceId, body as { name: string; website?: string; phone?: string; notes?: string });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
