import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  getWorkspacePipelineDeals,
} from "@/lib/integrations/product/contact-crm-context";
import {
  executeCrmAutomationAction,
  isCrmAutomationProvider,
} from "@/lib/crm/automation-actions";
import {
  requireCrmPermission,
  canCrmAction,
  getMembershipRole,
} from "@/lib/crm/permissions";
import type { CrmProviderId } from "@/lib/crm/types";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider") || undefined;

    const data = await getWorkspacePipelineDeals(auth.workspaceId, provider);

    // Inline stage moves require: provider write support + preferences allow +
    // the caller's RBAC permission. Otherwise the client shows "Open in CRM".
    const role = await getMembershipRole(auth.session.userId, auth.workspaceId);
    const canEdit = canCrmAction(role, "edit_crm_linked_records");
    const writableByProvider: Record<string, boolean> = {};
    for (const [p, prefOk] of Object.entries(data.writePrefsByProvider || {})) {
      writableByProvider[p] = Boolean(prefOk) && canEdit;
    }

    return NextResponse.json({
      data: { ...data, writableByProvider, canEdit },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

/**
 * Move a deal to a new pipeline stage via crm_automation_action deal.upsert.
 * Body: { provider, externalId, stageId, pipelineId? }
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    await requireCrmPermission(
      auth.session.userId,
      auth.workspaceId,
      "edit_crm_linked_records",
    );

    const body = (await request.json().catch(() => ({}))) as {
      provider?: string;
      externalId?: string;
      stageId?: string;
      pipelineId?: string;
    };

    const provider = String(body.provider || "");
    const externalId = String(body.externalId || "");
    const stageId = String(body.stageId || "");

    if (!isCrmAutomationProvider(provider) || !externalId || !stageId) {
      return NextResponse.json({ error: "provider, externalId, and stageId required" }, { status: 400 });
    }

    const result = await executeCrmAutomationAction({
      workspaceId: auth.workspaceId,
      provider: provider as CrmProviderId,
      actionId: "deal.upsert",
      params: {
        externalId,
        stageId,
        pipelineId: body.pipelineId || undefined,
      },
    });

    return NextResponse.json(
      result.ok ? { ok: true, data: result } : { error: result.message },
      { status: result.ok ? 200 : 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("Forbidden:")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return jsonError(err, 500);
  }
}
