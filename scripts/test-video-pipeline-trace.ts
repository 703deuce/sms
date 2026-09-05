import {
  isVideoPipelineTraceEnabled,
  summarizeVideoRoomState,
  traceVideoPipeline,
} from "../src/lib/transovo-video/video-pipeline-trace";

function main() {
  const prev = process.env.VIDEO_PIPELINE_TRACE;
  process.env.VIDEO_PIPELINE_TRACE = "1";
  if (!isVideoPipelineTraceEnabled()) throw new Error("expected trace enabled");

  traceVideoPipeline({
    layer: "video-client",
    step: "test_ping",
    outcome: "ok",
    roomId: "room-test",
  });

  const summary = summarizeVideoRoomState({
    status: "connected",
    localParticipantId: "local-1",
    participants: { size: 2 },
    streams: { size: 1 },
    subscriptions: { size: 1 },
  });
  if (summary.participantCount !== 2) throw new Error("bad participant summary");

  process.env.VIDEO_PIPELINE_TRACE = prev;
  console.log("OK video-pipeline-trace smoke test passed");
}

main();
