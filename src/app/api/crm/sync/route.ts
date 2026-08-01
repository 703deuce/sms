import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { isCrmProvider } from "@/lib/crm/registry";
import { enqueueCrmSync } from "@/lib/crm/sync-engine";
import type { SyncKind } from "@/lib/crm/sync-engine";
import { validateCrmProductionConnection } from "@/lib/crm/validate";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { requireCrmPermission } = await import("@/lib/crm/permissions");
    const body = (await request.json()) as {
      provider?: string;
      kind?: SyncKind;
      validateOnly?: boolean;
      writeProbe?: boolean;
    };
    const provider = body.provider?.trim();
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "Unsupported CRM provider" }, { status: 400 });
    }

    if (body.validateOnly) {
      await requireCrmPermission(auth.session.userId, auth.workspaceId, "access_crm_diagnostics");
      const result = await validateCrmProductionConnection(auth.workspaceId, provider, {
        writeProbe: Boolean(body.writeProbe),
      });
      return NextResponse.json({ data: result }, { status: result.ok ? 200 : 422 });
    }

    await requireCrmPermission(auth.session.userId, auth.workspaceId, "run_manual_sync");
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
