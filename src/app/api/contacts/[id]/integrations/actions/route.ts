import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  executeCrmAutomationAction,
  isCrmAutomationProvider,
} from "@/lib/crm/automation-actions";
import { enqueueCrmSync } from "@/lib/crm/sync-engine";
import type { CrmProviderId } from "@/lib/crm/types";

/**
 * Quick CRM actions from contact Connected Records panel.
 * Body: { action: "sync_now" | "note.create" | "task.create", provider, ...params }
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
    };
    const provider = String(body.provider || "");
    const action = String(body.action || "");

    if (!isCrmAutomationProvider(provider)) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    if (action === "sync_now") {
      const run = await enqueueCrmSync({
        workspaceId: auth.workspaceId,
        provider: provider as CrmProviderId,
        kind: "manual",
        triggeredBy: auth.session.userId,
      });
      return NextResponse.json({ ok: true, data: { syncRunId: run.id } });
    }

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

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 500);
  }
}
