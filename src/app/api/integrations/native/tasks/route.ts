import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { syncCrmTasksIntoUnifiedView } from "@/lib/integrations/framework/crm-task-bridge";
import { getActionCapabilityTruth } from "@/lib/integrations/framework/capability-truth";
import { isExternalProvider } from "@/lib/integrations/framework";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import type { IntegrationActionId } from "@/lib/integrations/framework/actions-registry";

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
      const caps = isExternalProvider(provider)
        ? {
            create: getActionCapabilityTruth(provider, "task.create").supported,
            note: getActionCapabilityTruth(provider, "note.create").supported,
          }
        : { create: false, note: false };
      return {
        id: t.id,
        provider: t.provider,
        externalId: t.externalId,
        contactId: t.contactId,
        title: t.title,
        description: (meta.description as string) || null,
        status: t.status,
        priority: t.priority,
        dueAt: t.dueAt?.toISOString() || null,
        ownerName: t.ownerName,
        relatedDealId: t.relatedDealId,
        relatedCompanyId: t.relatedCompanyId,
        relatedTicketId: t.relatedTicketId,
        syncStatus: t.syncStatus,
        providerUrl: t.externalUrl,
        lastSyncedAt: t.lastSyncedAt?.toISOString() || null,
        capabilities: {
          ...caps,
          openInProvider: Boolean(t.externalUrl),
          complete: caps.create,
          reassign: false,
          reschedule: caps.create,
          addNote: caps.note,
          retrySync: t.syncStatus === "failed",
        },
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
    const body = (await request.json()) as {
      action?: string;
      provider?: string;
      taskId?: string;
      params?: Record<string, unknown>;
      contactId?: string | null;
    };

    if (body.action === "retry_sync" && body.taskId) {
      await getPrisma().integrationTask.updateMany({
        where: { id: body.taskId, workspaceId: auth.workspaceId },
        data: { syncStatus: "pending" },
      });
      return NextResponse.json({ data: { ok: true } });
    }

    const provider = String(body.provider || "");
    const actionId = String(body.action || "task.create") as IntegrationActionId;
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
