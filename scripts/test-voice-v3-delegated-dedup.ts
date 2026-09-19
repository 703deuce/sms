import assert from "node:assert/strict";
import {
  claimDelegatedAstraResponse,
  clearDelegatedAstraResponseDedup,
  extractDelegatedAstraResponseId,
} from "../src/lib/voice-v3/intake/delegated-response-dedup";

const SESSION = "live_test_dedup";

function main() {
  clearDelegatedAstraResponseDedup(SESSION);

  const responseId = "resp_abc123";
  const argumentsDone = {
    type: "response.function_call_arguments.done",
    response_id: responseId,
    name: "update_intake",
    arguments: "{}",
  };
  const outputItemDone = {
    type: "response.output_item.done",
    item: {
      type: "function_call",
      id: "fc_item_only_id",
      response_id: responseId,
      name: "update_intake",
    },
  };
  const completed = {
    type: "response.completed",
    response: { id: responseId, output: [] },
  };

  assert.equal(extractDelegatedAstraResponseId(argumentsDone), responseId);
  assert.equal(extractDelegatedAstraResponseId(outputItemDone), responseId);
  assert.equal(extractDelegatedAstraResponseId(completed), responseId);

  assert.equal(claimDelegatedAstraResponse(SESSION, argumentsDone), true);
  assert.equal(claimDelegatedAstraResponse(SESSION, outputItemDone), false);
  assert.equal(claimDelegatedAstraResponse(SESSION, completed), false);

  clearDelegatedAstraResponseDedup(SESSION);
  console.log("PASS voice-v3 delegated response dedup");
}

main();
