import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { syncCrmTasksIntoUnifiedView } from "@/lib/integrations/framework/crm-task-bridge";
import { getActionCapabilityTruth } from "@/lib/integrations/framework/capability-truth";
import { isExternalProvider } from "@/lib/integrations/framework";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import type { IntegrationActionId } from "@/lib/integrations/framework/actions-registry";
import {
  executeCrmAutomationAction,
  isCrmAutomationProvider,
} from "@/lib/crm/automation-actions";
import { isFeatureSupported } from "@/lib/crm/feature-matrix";
import { requireCrmPermission } from "@/lib/crm/permissions";
import type { CrmProviderId } from "@/lib/crm/types";

const COMPLETED_STATUSES = ["completed", "complete", "closed", "done"];

function isCompleted(status: string): boolean {
  return COMPLETED_STATUSES.includes(status.toLowerCase());
}

function taskCapabilities(provider: string, hasUrl: boolean, syncStatus: string) {
  if (isCrmAutomationProvider(provider)) {
    const tasks = isFeatureSupported(provider, "tasks");
    const notes = isFeatureSupported(provider, "notes");
    return {
      create: tasks,
      note: notes,
      openInProvider: hasUrl,
      complete: tasks,
      completeInCrm: tasks,
      reassign: tasks,
      reschedule: tasks,
      addNote: notes,
      retrySync: syncStatus === "failed" || syncStatus === "error",
    };
  }
  if (isExternalProvider(provider)) {
    const create = getActionCapabilityTruth(provider, "task.create").supported;
    const note = getActionCapabilityTruth(provider, "note.create").supported;
    return {
      create,
      note,
      openInProvider: hasUrl,
      // Framework adapters expose no task.complete capability — completing only
      // marks the unified copy done locally.
      complete: true,
      completeInCrm: false,
      reassign: false,
      reschedule: create,
      addNote: note,
      retrySync: syncStatus === "failed" || syncStatus === "error",
    };
  }
  // Transovo-only tasks.
  return {
    create: false,
    note: false,
    openInProvider: hasUrl,
    complete: true,
    completeInCrm: false,
    reassign: false,
    reschedule: false,
    addNote: false,
    retrySync: false,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    if (searchParams.get("syncCrm") === "1") {
      await syncCrmTasksIntoUnifiedView(auth.workspaceId);
    }

    const rows = await getPrisma().integrationTask.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 200,
    });

    const tasks = (
      rows as Array<{
        id: string;
        provider: string;
        externalId: string;
        contactId: string | null;
        title: string;
        status: string;
        priority: string | null;
        dueAt: Date | null;
        ownerExternalId: string | null;
        ownerName: string | null;
        relatedDealId: string | null;
        relatedCompanyId: string | null;
        relatedTicketId: string | null;
        syncStatus: string;
        externalUrl: string | null;
        metadataJson: unknown;
        lastSyncedAt: Date | null;
      }>
    ).map((t) => {
      const meta = (t.metadataJson || {}) as Record<string, unknown>;
      const provider = t.provider;
      const isCrm = isCrmAutomationProvider(provider);
      const isExternal = isExternalProvider(provider);
      const origin =
        (meta.origin as string) ||
        (meta.completedVia === "transovo" ? "transovo" : null) ||
        (isCrm || isExternal ? "crm" : "transovo");
      const completed = isCompleted(t.status);
      const completedVia = (meta.completedVia as string) || null;

      return {
        id: t.id,
        provider: t.provider,
        externalId: t.externalId,
        contactId: t.contactId,
        title: t.title,
        description: (meta.description as string) || null,
        status: t.status,
        completed,
        priority: t.priority,
        dueAt: t.dueAt?.toISOString() || null,
        ownerExternalId: t.ownerExternalId,
        ownerName: t.ownerName,
        relatedDealId: t.relatedDealId,
        relatedCompanyId: t.relatedCompanyId,
        relatedTicketId: t.relatedTicketId,
        syncStatus: t.syncStatus,
        providerUrl: t.externalUrl,
        lastSyncedAt: t.lastSyncedAt?.toISOString() || null,
        origin,
        completedVia,
        capabilities: taskCapabilities(provider, Boolean(t.externalUrl), t.syncStatus),
      };
    });

    return NextResponse.json({ data: { tasks } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const body = (await request.json()) as {
      action?: string;
      provider?: string;
      taskId?: string;
      params?: Record<string, unknown>;
      contactId?: string | null;
    };

    if (body.action === "retry_sync" && body.taskId) {
      await prisma.integrationTask.updateMany({
        where: { id: body.taskId, workspaceId: auth.workspaceId },
        data: { syncStatus: "pending" },
      });
      return NextResponse.json({ data: { ok: true } });
    }

    // Complete a task — pushes to the mapped CRM task when the provider + role
    // permit, then marks the unified copy done.
    if (body.action === "complete" && body.taskId) {
      const task = await prisma.integrationTask.findFirst({
        where: { id: body.taskId, workspaceId: auth.workspaceId },
      });
      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      let completedVia: "crm" | "transovo" = "transovo";
      let crmMessage: string | null = null;

      if (
        isCrmAutomationProvider(task.provider) &&
        task.externalId &&
        isFeatureSupported(task.provider, "tasks")
      ) {
        try {
          await requireCrmPermission(
            auth.session.userId,
            auth.workspaceId,
            "edit_crm_linked_records",
          );
        } catch (permErr) {
          const message =
            permErr instanceof Error ? permErr.message : String(permErr);
          return NextResponse.json({ error: message }, { status: 403 });
        }

        const result = await executeCrmAutomationAction({
          workspaceId: auth.workspaceId,
          provider: task.provider as CrmProviderId,
          actionId: "task.complete",
          contactId: task.contactId,
          params: { externalId: task.externalId, title: task.title },
        });
        if (!result.ok) {
          // Surface the CRM failure and flag the sync so Retry appears.
          await prisma.integrationTask.update({
            where: { id: task.id },
            data: { syncStatus: "failed" },
          });
          return NextResponse.json({ error: result.message }, { status: 400 });
        }
        completedVia = "crm";
        crmMessage = "Completed in CRM";
      }

      const meta = (task.metadataJson || {}) as Record<string, unknown>;
      await prisma.integrationTask.update({
        where: { id: task.id },
        data: {
          status: "completed",
          syncStatus: completedVia === "crm" ? "synced" : task.syncStatus,
          lastSyncedAt: completedVia === "crm" ? new Date() : task.lastSyncedAt,
          metadataJson: {
            ...meta,
            completedVia,
            completedAt: new Date().toISOString(),
          } as object,
        },
      });

      return NextResponse.json({
        data: { ok: true, completedVia, message: crmMessage },
      });
    }

    const provider = String(body.provider || "");
    const actionId = String(body.action || "task.create") as IntegrationActionId;

    // CRM provider quick actions (note.create) go through the CRM connector.
    if (isCrmAutomationProvider(provider)) {
      try {
        await requireCrmPermission(
          auth.session.userId,
          auth.workspaceId,
          "use_crm_quick_actions",
        );
      } catch (permErr) {
        const message = permErr instanceof Error ? permErr.message : String(permErr);
        return NextResponse.json({ error: message }, { status: 403 });
      }
      const result = await executeCrmAutomationAction({
        workspaceId: auth.workspaceId,
        provider: provider as CrmProviderId,
        actionId: String(body.action || "note.create"),
        contactId: body.contactId || null,
        params: body.params || {},
      });
      return NextResponse.json(
        result.ok ? { data: result } : { error: result.message },
        { status: result.ok ? 200 : 400 },
      );
    }

    if (!isExternalProvider(provider)) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }
    const truth = getActionCapabilityTruth(provider, actionId);
    if (!truth.supported) {
      return NextResponse.json(
        { error: truth.reason, reconnectHint: truth.reconnectHint },
        { status: 400 },
      );
    }

    await enqueueJob({
      jobType: "integration_action",
      queueName: `ext-${provider}`,
      workspaceId: auth.workspaceId,
      priority: 25,
      payload: JSON.parse(
        JSON.stringify({
          workspaceId: auth.workspaceId,
          provider,
          actionId,
          params: body.params || {},
          contactId: body.contactId || null,
          actorUserId: auth.session.userId,
          source: "human",
        }),
      ),
    });

    return NextResponse.json({ data: { queued: true } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
