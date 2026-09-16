import "server-only";

import { getPrisma } from "@/lib/db";
import { notifyWorkspace } from "@/lib/notifications/in-app";
import { shouldMarkCallbackOverdue } from "./callback-sla";

export const VOICE_V2_CALLBACK_SLA_OVERDUE_JOB = "voice_v2_callback_sla_overdue_scan";

export async function executeVoiceV2CallbackSlaOverdueScan(): Promise<{
  scanned: number;
  marked: number;
}> {
  const prisma = getPrisma();
  const rows = await prisma.callbackRequest.findMany({
    where: {
      status: { in: ["new", "contacted"] },
    },
    select: {
      id: true,
      workspaceId: true,
      callerE164: true,
      metadata: true,
    },
    take: 200,
    orderBy: { requestedAt: "asc" },
  });

  let marked = 0;
  for (const row of rows) {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    if (!shouldMarkCallbackOverdue(meta)) continue;
    const sla = { ...(meta.voiceV2CallbackSla as Record<string, unknown>) };
    if (sla.overdueNotifiedAt) continue;
    sla.lifecycle = "OVERDUE";
    sla.overdueNotifiedAt = new Date().toISOString();
    await prisma.callbackRequest.update({
      where: { id: row.id },
      data: {
        metadata: { ...meta, voiceV2CallbackSla: sla },
      },
    });
    await notifyWorkspace(row.workspaceId, {
      type: "callback_overdue",
      title: "Callback overdue",
      body: `Callback from ${row.callerE164} is past its promised deadline.`,
      href: "/voice/callback-requests",
    }).catch(() => undefined);
    marked += 1;
  }

  return { scanned: rows.length, marked };
}
