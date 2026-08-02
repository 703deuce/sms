import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { displayNameForProvider } from "@/lib/integrations/product/contact-crm-context";

/**
 * Call-level CRM sync context: the CRM call activity mirrored from this Transovo
 * call, plus any CRM task related to the caller.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const prisma = getPrisma();

    const call = await prisma.humanCall.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const mappingRows = (await prisma.crmObjectMapping.findMany({
      where: {
        workspaceId: auth.workspaceId,
        objectType: "call",
        internalId: id,
        provider: { in: ["salesforce", "zoho", "pipedrive"] },
      },
    })) as Array<{
      id: string;
      provider: string;
      externalId: string;
      externalUrl: string | null;
      syncStatus: string;
      lastSyncedAt: Date | null;
    }>;

    const callActivities = mappingRows.map((m) => ({
      id: m.id,
      provider: m.provider,
      displayName: displayNameForProvider(m.provider),
      externalId: m.externalId,
      externalUrl: m.externalUrl,
      syncStatus: m.syncStatus,
      lastSyncedAt: m.lastSyncedAt?.toISOString() || null,
    }));

    let relatedTasks: Array<{
      id: string;
      provider: string;
      title: string;
      status: string;
      dueAt: string | null;
      externalUrl: string | null;
    }> = [];

    if (call.contactId) {
      const tasks = (await prisma.integrationTask.findMany({
        where: {
          workspaceId: auth.workspaceId,
          contactId: call.contactId,
          provider: { in: ["salesforce", "zoho", "pipedrive"] },
        },
        orderBy: { dueAt: "asc" },
        take: 10,
      })) as Array<{
        id: string;
        provider: string;
        title: string;
        status: string;
        dueAt: Date | null;
        externalUrl: string | null;
      }>;
      relatedTasks = tasks.map((t) => ({
        id: t.id,
        provider: t.provider,
        title: t.title,
        status: t.status,
        dueAt: t.dueAt?.toISOString() || null,
        externalUrl: t.externalUrl,
      }));
    }

    return NextResponse.json({
      data: {
        contactId: call.contactId,
        disposition: call.disposition || null,
        hasRecording: Boolean(call.recordingUrl),
        hasTranscript: Boolean(call.transcriptText),
        hasSummary: Boolean(call.aiSummary),
        synced: callActivities.length > 0,
        callActivities,
        relatedTasks,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
