import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  executeCrmAutomationAction,
  isCrmAutomationProvider,
} from "@/lib/crm/automation-actions";
import { enqueueCrmSync } from "@/lib/crm/sync-engine";
import { requireCrmPermission } from "@/lib/crm/permissions";
import {
  resolvePendingConflict,
  type ConflictDecision,
} from "@/lib/crm/conflicts-ui";
import { isCrmProvider } from "@/lib/crm/registry";
import type { CrmProviderId } from "@/lib/crm/types";

/**
 * Quick CRM actions from contact Connected Records panel.
 * Body: { action, provider, ...params }
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: contactId } = await context.params;
    const contact = await getPrisma().contact.findFirst({
      where: { id: contactId, workspaceId: auth.workspaceId },
    });
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      provider?: string;
      body?: string;
      title?: string;
      dueAt?: string;
      externalId?: string;
      stageId?: string;
      pipelineId?: string;
      objectType?: string;
      ownerExternalId?: string;
      status?: string;
      relatedType?: string;
      relatedExternalId?: string;
      conflictId?: string;
      decision?: string;
      remember?: boolean;
    };
    const provider = String(body.provider || "");
    const action = String(body.action || "");

    if (!isCrmAutomationProvider(provider)) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    // ---- Conflict resolution (contact-scoped duplicate/merge) ----
    if (action === "resolve_conflict") {
      await requireCrmPermission(
        auth.session.userId,
        auth.workspaceId,
        "resolve_mapping_conflicts",
      );
      if (!isCrmProvider(provider)) {
        return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
      }
      const allowed: ConflictDecision[] = [
        "use_crm",
        "use_transovo",
        "merge",
        "ignore",
      ];
      const decision = body.decision as ConflictDecision | undefined;
      if (!body.conflictId || !decision || !allowed.includes(decision)) {
        return NextResponse.json(
          { error: "conflictId and valid decision required" },
          { status: 400 },
        );
      }
      const result = await resolvePendingConflict({
        workspaceId: auth.workspaceId,
        provider,
        conflictId: body.conflictId,
        decision,
        remember: Boolean(body.remember),
        actorUserId: auth.session.userId,
      });
      return NextResponse.json({ ok: true, data: result });
    }

    if (action === "sync_now") {
      await requireCrmPermission(
        auth.session.userId,
        auth.workspaceId,
        "force_sync",
      );
      const run = await enqueueCrmSync({
        workspaceId: auth.workspaceId,
        provider: provider as CrmProviderId,
        kind: "manual",
        triggeredBy: auth.session.userId,
      });
      return NextResponse.json({ ok: true, data: { syncRunId: run.id } });
    }

    await requireCrmPermission(
      auth.session.userId,
      auth.workspaceId,
      "use_crm_quick_actions",
    );

    if (action === "note.create") {
      const result = await executeCrmAutomationAction({
        workspaceId: auth.workspaceId,
        provider,
        actionId: "note.create",
        contactId,
        params: {
          body: body.body || "Note from Transovo",
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
          email: contact.email,
          relatedType: body.relatedType,
          relatedExternalId: body.relatedExternalId,
        },
      });
      return NextResponse.json(
        result.ok ? { ok: true, data: result } : { error: result.message },
        { status: result.ok ? 200 : 400 },
      );
    }

    if (action === "task.create") {
      const result = await executeCrmAutomationAction({
        workspaceId: auth.workspaceId,
        provider,
        actionId: "task.create",
        contactId,
        params: {
          title: body.title || `Follow up with ${contact.firstName || contact.phone}`,
          dueAt: body.dueAt || null,
          phone: contact.phone,
          email: contact.email,
        },
      });
      return NextResponse.json(
        result.ok ? { ok: true, data: result } : { error: result.message },
        { status: result.ok ? 200 : 400 },
      );
    }

    if (action === "change_owner") {
      await requireCrmPermission(
        auth.session.userId,
        auth.workspaceId,
        "edit_crm_linked_records",
      );
      const objectType = String(body.objectType || "contact");
      const actionId =
        objectType === "lead"
          ? "lead.assign"
          : objectType === "deal"
            ? "deal.change_owner"
            : objectType === "company"
              ? "company.change_owner"
              : "contact.change_owner";
      const result = await executeCrmAutomationAction({
        workspaceId: auth.workspaceId,
        provider,
        actionId,
        contactId,
        params: {
          externalId: body.externalId,
          ownerExternalId: body.ownerExternalId,
        },
      });
      return NextResponse.json(
        result.ok ? { ok: true, data: result } : { error: result.message },
        { status: result.ok ? 200 : 400 },
      );
    }

    if (action === "change_status") {
      await requireCrmPermission(
        auth.session.userId,
        auth.workspaceId,
        "edit_crm_linked_records",
      );
      const objectType = String(body.objectType || "contact");
      const actionId =
        objectType === "lead" ? "lead.change_status" : "contact.change_status";
      const result = await executeCrmAutomationAction({
        workspaceId: auth.workspaceId,
        provider,
        actionId,
        contactId,
        params: {
          externalId: body.externalId,
          status: body.status,
        },
      });
      return NextResponse.json(
        result.ok ? { ok: true, data: result } : { error: result.message },
        { status: result.ok ? 200 : 400 },
      );
    }

    if (action === "deal.upsert" || action === "deal.stage_update") {
      await requireCrmPermission(
        auth.session.userId,
        auth.workspaceId,
        "edit_crm_linked_records",
      );
      const result = await executeCrmAutomationAction({
        workspaceId: auth.workspaceId,
        provider,
        actionId: "deal.upsert",
        contactId,
        params: {
          externalId: body.externalId,
          stageId: body.stageId,
          pipelineId: body.pipelineId,
        },
      });
      return NextResponse.json(
        result.ok ? { ok: true, data: result } : { error: result.message },
        { status: result.ok ? 200 : 400 },
      );
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("Forbidden:")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return jsonError(err, 500);
  }
}
