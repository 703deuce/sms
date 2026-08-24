import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { uploadCallRecordingToStorage } from "./call-recording-storage";

export async function shouldRecordInboundCall(workspaceId: string): Promise<boolean> {
  const settings = await getPrisma().smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId },
    select: { recordingEnabledInbound: true },
  });
  return Boolean(settings?.recordingEnabledInbound);
}

export async function shouldRecordOutboundCall(workspaceId: string): Promise<boolean> {
  const settings = await getPrisma().smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId },
    select: { recordingEnabledOutbound: true },
  });
  return Boolean(settings?.recordingEnabledOutbound);
}

export async function createCallRecordingRow(input: {
  workspaceId: string;
  callSessionId?: string | null;
  outboundCallId?: string | null;
  providerRecordingId?: string | null;
  direction?: string | null;
}) {
  const prisma = getPrisma();
  const settings = await prisma.smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  const retentionDays = settings?.recordingRetentionDays ?? 90;
  const retentionExpiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

  return prisma.smartRoutingCallRecording.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      callSessionId: input.callSessionId ?? null,
      outboundCallId: input.outboundCallId ?? null,
      providerRecordingId: input.providerRecordingId ?? null,
      direction: input.direction ?? "inbound",
      retentionExpiresAt,
      transcriptStatus: settings?.recordingTranscriptionEnabled ? "pending" : "disabled",
      summaryStatus: settings?.recordingSummaryEnabled ? "pending" : "disabled",
    },
  });
}

export async function finalizeCallRecordingFromProvider(input: {
  workspaceId: string;
  recordingId: string;
  downloadUrl: string;
  durationSeconds?: number | null;
  mimeType?: string | null;
}) {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingCallRecording.findFirst({
    where: { id: input.recordingId, workspaceId: input.workspaceId },
  });
  if (!row) return null;

  const res = await fetch(input.downloadUrl);
  if (!res.ok) throw new Error(`Failed to fetch recording: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const stored = await uploadCallRecordingToStorage({
    workspaceId: input.workspaceId,
    callId: row.callSessionId ?? row.outboundCallId ?? row.id,
    bytes,
    mimeType: input.mimeType ?? "audio/mpeg",
  });

  await prisma.smartRoutingCallRecording.update({
    where: { id: row.id },
    data: {
      storagePath: stored.path,
      storageBucket: stored.bucket,
      mimeType: input.mimeType ?? "audio/mpeg",
      durationSeconds: input.durationSeconds ?? null,
      transcriptStatus:
        row.transcriptStatus === "disabled" ? "disabled" : "pending",
      summaryStatus: row.summaryStatus === "disabled" ? "disabled" : "pending",
    },
  });

  if (row.transcriptStatus !== "disabled") {
    const { queueRecordingTranscription } = await import("./call-recording-pipeline");
    await queueRecordingTranscription(row.id);
  }

  return row.id;
}
