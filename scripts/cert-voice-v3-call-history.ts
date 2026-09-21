/**
 * Voice V3 Call History certification (read-only + optional forced Deepgram).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/cert-voice-v3-call-history.ts
 *
 * Env:
 *   CALL_ID=...              required
 *   WORKSPACE_ID=...         optional (scoped lookup)
 *   FORCE_DEEPGRAM=1         run Deepgram fallback directly (does not weaken validator)
 *   PLAYBACK_HTTP=1          HEAD request on signed stream URL (no body logged)
 */
import assert from "node:assert/strict";
import { getPrisma } from "../src/lib/db";
import { validateNativeCustomerTranscript } from "../src/lib/voice-v3/call-history/native-transcript-validator";
import { runVoiceV3CallHistoryPostProcess } from "../src/lib/voice-v3/call-history/post-call-pipeline";
import { runDeepgramFallbackForCall } from "../src/lib/voice-v3/call-history/deepgram-fallback";
import { createRecordingAccessToken } from "../src/lib/voice/recordings";
import { resolveCallRecordingsBucket } from "../src/lib/smart-routing/call-recording-storage";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";

let callId = process.env.CALL_ID?.trim();
const callIdSuffix = process.env.CALL_ID_SUFFIX?.trim();

const workspaceIdFilter = process.env.WORKSPACE_ID?.trim();

async function main() {
  const prisma = getPrisma();
  if (!callId && callIdSuffix) {
    const hit = await prisma.voiceCall.findFirst({
      where: { id: { contains: callIdSuffix } },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    callId = hit?.id;
  }
  if (!callId) {
    console.error("CALL_ID or CALL_ID_SUFFIX required");
    process.exit(1);
  }
  const call = await prisma.voiceCall.findFirst({
    where: workspaceIdFilter ? { id: callId, workspaceId: workspaceIdFilter } : { id: callId },
  });

  if (!call) {
    console.error("CALL_NOT_FOUND", { callId });
    process.exit(2);
  }

  const recordings =
    (await prisma.voiceRecording.findMany({
      where: { callId: call.id },
      orderBy: { createdAt: "desc" },
    })) ?? [];
  const transcriptRows =
    (await prisma.voiceTranscript.findMany({
      where: { callId: call.id },
    })) ?? [];
  const transcripts = await Promise.all(
    transcriptRows.map(async (t) => ({
      ...t,
      segments:
        (await prisma.voiceTranscriptSegment.findMany({
          where: { transcriptId: t.id },
          orderBy: { startMs: "asc" },
        })) ?? [],
    })),
  );
  const insights =
    (await prisma.voiceConversationInsight.findMany({ where: { callId: call.id } })) ?? [];
  const appointments =
    (await prisma.voiceAppointment.findMany({ where: { callId: call.id } })) ?? [];

  const report: Record<string, unknown> = {
    callId: call.id,
    workspaceId: call.workspaceId,
    direction: call.direction,
    durationSeconds: call.durationSeconds,
    appointmentBooked: call.appointmentBooked,
    startedAt: call.startedAt.toISOString(),
    endedAt: call.endedAt?.toISOString() ?? null,
  };

  const rec = recordings[0];
  report.recording = rec
    ? {
        id: rec.id,
        status: rec.status,
        provider: rec.provider,
        providerRecordingId: rec.providerRecordingId,
        format: rec.format,
        channels: rec.channels,
        durationSeconds: rec.durationSeconds,
        storageUrlPrefix: rec.storageUrl?.startsWith("supabase:") ? "supabase" : "external",
      }
    : null;

  const native = transcripts.find(
    (t) => t.provider === "voice_v3_livekit" || t.provider === "livekit",
  );
  const deepgram = transcripts.find((t) => t.provider === "deepgram");
  report.deepgramTranscript = deepgram
    ? {
        provider: deepgram.provider,
        status: deepgram.status,
        segmentCount: deepgram.segments?.length ?? 0,
      }
    : null;
  report.appointments = appointments.map((a) => ({
    id: a.id,
    status: a.status,
    serviceName: a.serviceName,
    startsAt: a.startsAt.toISOString(),
  }));

  if (native) {
    const validation = validateNativeCustomerTranscript({
      segments: native.segments ?? [],
      durationSeconds: call.durationSeconds,
      forensicsFinal: true,
    });
    report.nativeTranscript = {
      provider: native.provider,
      status: native.status,
      segmentCount: native.segments?.length ?? 0,
      callerTurns: validation.callerTurns,
      agentTurns: validation.agentTurns,
      validatorValid: validation.valid,
      validatorReasons: validation.reasons,
    };
  } else {
    report.nativeTranscript = { present: false };
  }

  if (process.env.FORCE_DEEPGRAM === "1" && rec?.storageUrl && rec.status === "ready") {
    const t0 = Date.now();
    const dg = await runDeepgramFallbackForCall({
      workspaceId: call.workspaceId,
      callId: call.id,
      recordingId: rec.id,
      storageUrl: rec.storageUrl,
      channels: rec.channels,
    });
    report.forceDeepgram = { ...dg, elapsed_ms: Date.now() - t0 };
    const again = await runDeepgramFallbackForCall({
      workspaceId: call.workspaceId,
      callId: call.id,
      recordingId: rec.id,
      storageUrl: rec.storageUrl,
      channels: rec.channels,
    });
    report.forceDeepgramRetry = again;
  }

  const post = await runVoiceV3CallHistoryPostProcess(call.id);
  report.postCallPipeline = post;

  const refreshed = await prisma.voiceCall.findUnique({
    where: { id: call.id },
    select: { metadata: true, insights: true },
  });
  const meta = (refreshed?.metadata || {}) as Record<string, unknown>;
  report.callHistory = meta.callHistory ?? null;
  report.recordingChannelSemantics = meta.recordingChannelSemantics ?? null;
  report.summary = refreshed?.insights?.[0]?.summary?.slice(0, 500) ?? null;

  if (rec?.id && process.env.PLAYBACK_HTTP === "1") {
    const { token } = createRecordingAccessToken(rec.id, call.workspaceId, 120);
    const base = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
    const url = `${base}/api/voice/recordings/${rec.id}/stream?token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { method: "GET", redirect: "manual" });
    report.playbackHttp = { status: res.status, location: res.headers.get("location") ? "redacted" : null };
  }

  const bucket = resolveCallRecordingsBucket();
  try {
    const supabase = getSupabaseAdmin();
    const { data: buckets } = await supabase.storage.listBuckets();
    const row = buckets?.find((b) => b.name === bucket);
    report.storageBucket = {
      name: bucket,
      exists: Boolean(row),
      public: row?.public ?? null,
    };
  } catch (e) {
    report.storageBucket = { error: e instanceof Error ? e.message : String(e) };
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
