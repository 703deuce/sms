#!/usr/bin/env node
/**
 * Ensures LiveKit HTTP tool responses include nested `data` for Python transfer_executor.
 */
import assert from "node:assert/strict";

function mapLikeEngineResult(result) {
  if (!result.ok) return result;
  const payload = result.data ?? {};
  return {
    ok: true,
    status: result.status,
    ...payload,
    ...(typeof payload === "object" && payload !== null && Object.keys(payload).length > 0
      ? { data: payload }
      : {}),
  };
}

const engine = {
  ok: true,
  status: "transfer_authorized",
  data: {
    execution: { targets: [{ dial_target: "+17038166017" }] },
    route_id: "cr_billing",
  },
};

const mapped = mapLikeEngineResult(engine);
assert.ok(mapped.data?.execution, "nested data.execution required for Python");
assert.equal(mapped.execution?.targets?.[0]?.dial_target, "+17038166017");
console.log("test-transfer-tool-response-shape: PASS");
