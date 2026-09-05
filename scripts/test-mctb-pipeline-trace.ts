/**
 * Smoke test for MCTB pipeline trace helpers (no DB).
 */
import {
  isMctbPipelineTraceEnabled,
  summarizeTexmlPayload,
  traceMctbPipeline,
  traceMctbPipelineSkip,
  tracePhoneNormalization,
} from "../src/lib/mctb/pipeline-trace";

function main() {
  const prev = process.env.MCTB_PIPELINE_TRACE;
  process.env.MCTB_PIPELINE_TRACE = "1";

  if (!isMctbPipelineTraceEnabled()) {
    throw new Error("expected pipeline trace enabled");
  }

  traceMctbPipeline({
    layer: "texml-status",
    step: "test_ping",
    outcome: "ok",
    note: "pipeline trace smoke test",
  });

  traceMctbPipelineSkip("process", "test_skip", "unit_test_reason", {
    workspaceId: "ws_test",
  });

  const summary = summarizeTexmlPayload({
    From: "+15551234567",
    To: "+18663464256",
    CallSid: "CA123",
    CallStatus: "completed",
    extraField: "ignored-unless-verbose",
  });
  if (!summary.From || !summary.To || !summary.CallSid) {
    throw new Error("summarizeTexmlPayload missing expected fields");
  }

  const normalized = tracePhoneNormalization({
    layer: "texml-status",
    field: "to",
    raw: "+18663464256",
    normalized: "+18663464256",
  });
  if (normalized !== "+18663464256") {
    throw new Error("expected normalized E164");
  }

  const invalid = tracePhoneNormalization({
    layer: "texml-status",
    field: "to",
    raw: "not-a-phone",
    normalized: null,
  });
  if (invalid !== null) {
    throw new Error("expected null for invalid phone");
  }

  process.env.MCTB_PIPELINE_TRACE = prev;
  console.log("OK mctb-pipeline-trace smoke test passed");
}

main();
