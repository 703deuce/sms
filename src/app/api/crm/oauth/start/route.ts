import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { startCrmOAuth } from "@/lib/crm/oauth";
import { isCrmProvider } from "@/lib/crm/registry";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { provider?: string };
    const provider = body.provider?.trim();
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "Unsupported CRM provider" }, { status: 400 });
    }
    const result = await startCrmOAuth(auth.workspaceId, provider);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
