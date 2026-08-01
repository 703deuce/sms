import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { isCrmProvider } from "@/lib/crm/registry";
import { enqueueCrmSync, validateCrmConnection } from "@/lib/crm/sync-engine";
import type { SyncKind } from "@/lib/crm/sync-engine";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      provider?: string;
      kind?: SyncKind;
      validateOnly?: boolean;
    };
    const provider = body.provider?.trim();
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "Unsupported CRM provider" }, { status: 400 });
    }

    if (body.validateOnly) {
      const health = await validateCrmConnection(auth.workspaceId, provider);
      return NextResponse.json({ data: health });
    }

    const run = await enqueueCrmSync({
      workspaceId: auth.workspaceId,
      provider,
      kind: body.kind || "manual",
      triggeredBy: auth.session.userId,
    });
    return NextResponse.json({ data: run }, { status: 202 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
