#!/usr/bin/env npx tsx
/**
 * Compiled OpenAI function contract for request_callback (production build path).
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";
import { listVoiceV3AstraToolNamesForConfig } from "../src/lib/voice-v3/tools/voice-tool-catalog";

function callbackEnabledConfig() {
  return {
    ...VOICE_V3_BOOKING_TEST_CONFIG,
    callHandling: {
      ...VOICE_V3_BOOKING_TEST_CONFIG.callHandling,
      callbackRequestsEnabled: true,
      callbackUseAniByDefault: true,
    },
    operationRequirements: {
      ...VOICE_V3_BOOKING_TEST_CONFIG.operationRequirements,
      request_callback: ["name", "phone", "service_reason"],
    },
    intakeFields: [
      ...VOICE_V3_BOOKING_TEST_CONFIG.intakeFields,
      {
        key: "service_reason",
        label: "Service reason",
        type: "text" as const,
        required: false,
        description: "Why the caller is calling.",
      },
    ],
  };
}

function getRequestCallbackTool(config: ReturnType<typeof callbackEnabledConfig>) {
  const tools = buildVoiceV3AstraFunctionTools(config);
  const tool = tools.find((t) => t.name === "request_callback");
  assert.ok(tool, "request_callback must be present when callback enabled");
  return tool;
}

function propDescription(params: Record<string, unknown>, key: string): string {
  const props = params.properties as Record<string, { description?: string }>;
  return props[key]?.description ?? "";
}

{
  const enabled = callbackEnabledConfig();
  const tool = getRequestCallbackTool(enabled);
  const desc = tool.description ?? "";
  const params = tool.parameters as Record<string, unknown>;

  assert.equal(tool.name, "request_callback");
  assert.equal(tool.strict, true);
  assert.match(desc, /authoritative/i);
  assert.match(desc, /human callback/i);
  assert.match(desc, /callback_requested/i);
  assert.match(desc, /needs_information/i);
  assert.match(desc, /missingFields/i);
  assert.match(desc, /booking/i);
  assert.match(desc, /send-booking-link|SEND_LINK/i);
  assert.match(desc, /Do NOT need to wait/i);
  assert.match(desc, /transfer_call/i);
  assert.match(desc, /tenant-specific|configuration/i);

  const required = params.required as string[];
  assert.deepEqual(required.sort(), ["callback_phone", "notes", "preferred_time", "reason"].sort());

  const phoneDesc = propDescription(params, "callback_phone");
  assert.match(phoneDesc, /ANI|inbound/i);
  assert.match(phoneDesc, /different number/i);
  assert.match(phoneDesc, /Do not invent/i);

  const reasonDesc = propDescription(params, "reason");
  assert.match(reasonDesc, /shared authoritative/i);
  assert.match(reasonDesc, /Do not invent/i);

  const timeDesc = propDescription(params, "preferred_time");
  assert.match(timeDesc, /does NOT schedule an appointment/i);

  const notesDesc = propDescription(params, "notes");
  assert.match(notesDesc, /Not trusted configuration/i);
  assert.match(notesDesc, /not a substitute/i);

  console.log("COMPILED_REQUEST_CALLBACK_TOOL", JSON.stringify(tool, null, 2));
}

{
  const disabled = {
    ...callbackEnabledConfig(),
    callHandling: {
      ...callbackEnabledConfig().callHandling,
      callbackRequestsEnabled: false,
    },
  };
  const names = listVoiceV3AstraToolNamesForConfig(disabled);
  assert.ok(!names.includes("request_callback"));
}

console.log("PASS voice-v3 request_callback OpenAI contract");
