/**
 * Deep audit for the latest voicemail test call.
 * Run: npx tsx scripts/audit-latest-voicemail-call.ts
 */
import { getPrisma } from "@/lib/db";
import { parseMctbVoicemailLifecycleTrace } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-lifecycle-trace";

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 30 * 60 * 1000);

  const vm = await prisma.voicemailMessage.findFirst({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  if (!vm) {
    console.log("No recent voicemailMessage");
    return;
  }

  const missed = await prisma.missedCallEvent.findFirst({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });

  const meta = (missed?.metadata || {}) as Record<string, unknown>;
  const providerCallId = String(meta.providerCallId || "");

  const jobs = await prisma.jobQueue.findMany({
    where: {
      createdAt: { gte: since },
      jobType: "ai_transcription_run",
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const features = await prisma.workspaceProductFeature.findMany({
    where: { workspaceId: vm.workspaceId },
    select: { featureKey: true, status: true },
  });

  console.log("\n=== Latest voicemailMessage ===");
  console.log(
    JSON.stringify(
      {
        id: vm.id,
        createdAt: vm.createdAt,
        fromE164: vm.fromE164,
        toE164: vm.toE164,
        durationSeconds: vm.durationSeconds,
        recordingUrl: vm.recordingUrl,
        transcriptStatus: vm.transcriptStatus,
        transcriptText: vm.transcriptText?.slice(0, 200) || null,
        aiSummary: vm.aiSummary,
        transcriptionError: vm.transcriptionError,
        isRead: vm.isRead,
      },
      null,
      2,
    ),
  );

  console.log("\n=== Linked missedCallEvent ===");
  console.log(
    JSON.stringify(
      missed
        ? {
            id: missed.id,
            at: missed.createdAt,
            caller: missed.callerE164,
            status: missed.status,
            suppressionReason: missed.suppressionReason,
            providerCallId,
            consentMode: meta.consentMode,
          }
        : null,
      null,
      2,
    ),
  );

  console.log("\n=== Transcription jobs (last 30m) ===");
  for (const j of jobs) {
    const p = (j.payload || {}) as Record<string, unknown>;
    console.log(
      JSON.stringify({
        id: j.id,
        status: j.status,
        at: j.createdAt,
        sourceType: p.sourceType,
        sourceId: p.sourceId,
        error: j.lastError?.slice(0, 200),
      }),
    );
  }
  if (!jobs.length) console.log("(none)");

  console.log("\n=== Workspace features ===");
  console.log(JSON.stringify(features, null, 2));

  console.log("\n=== Pipeline verdict ===");
  const lifecycle = parseMctbVoicemailLifecycleTrace(vm.internalNotes);
  const hasRecording = Boolean(vm.recordingUrl);
  const hasTranscript = Boolean(vm.transcriptText?.trim());
  const hasSummary = Boolean(vm.aiSummary?.trim());
  console.log(
    JSON.stringify(
      {
        recordingAttached: hasRecording,
        transcriptionComplete: vm.transcriptStatus === "completed" && hasTranscript,
        aiSummaryPresent: hasSummary,
        uiWouldShowAudio: hasRecording,
        uiWouldShowTranscript: hasTranscript,
        recordingError: vm.transcriptionError,
        lifecycleBuildSha: lifecycle?.buildSha || null,
        lifecycleEventCount: lifecycle?.events?.length || 0,
        lifecycleEvents: lifecycle?.events?.map((e) => `${e.at} ${e.event}`) || [],
      },
      null,
      2,
    ),
  );

  if (lifecycle?.events?.length) {
    console.log("\n=== Lifecycle trace detail ===");
    for (const e of lifecycle.events) {
      console.log(JSON.stringify({ at: e.at, event: e.event, payload: e.payload }));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
