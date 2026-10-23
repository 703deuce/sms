import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { humanizeCrmError } from "@/lib/crm/human-errors";
import { startCrmOAuth } from "@/lib/crm/oauth";
import { isCrmProvider } from "@/lib/crm/registry";
import { requireCrmPermission } from "@/lib/crm/permissions";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider")?.trim();
  if (!provider) {
    return NextResponse.json(
      { error: "Missing provider query parameter. Use POST with JSON body to start CRM connect." },
      { status: 400 },
    );
  }
  return NextResponse.json(
    {
      error:
        "CRM connect must be started with POST /api/crm/oauth/start and a JSON body { provider }. Prefetching this URL is not supported.",
    },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireCrmPermission(auth.session.userId, auth.workspaceId, "connect_crm");
    const body = (await request.json()) as { provider?: string };
    const provider = body.provider?.trim();
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "Unsupported CRM provider" }, { status: 400 });
    }
    const result = await startCrmOAuth(auth.workspaceId, provider);
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      {
        error: humanizeCrmError(err, "CRM connect"),
        technical: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }
}
