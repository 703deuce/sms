#!/usr/bin/env node
/**
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' node scripts/fetch-telnyx-assistant-snapshot.mjs [assistantId]
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// Dynamic import after preload registers tsx paths
const { telnyxRequest } = await import("../src/lib/messaging/telnyx/client.ts");

const id = process.argv[2] || "assistant-3decb330-61ca-4a28-bbc0-7d51bcc961d6";
const remote = await telnyxRequest(`/ai/assistants/${encodeURIComponent(id)}`);
const data = remote.data || remote;
const tools = Array.isArray(data.tools) ? data.tools : [];
console.log(
  JSON.stringify(
    {
      id: data.id,
      name: data.name,
      model: data.model,
      llm_api_key_ref: data.llm_api_key_ref,
      external_llm: data.external_llm,
      voice_settings: data.voice_settings,
      transcription: data.transcription,
      interruption_settings: data.interruption_settings,
      start_speaking_plan: data.start_speaking_plan,
      enabled_features: data.enabled_features,
      telephony_settings: data.telephony_settings,
      conversation_flow_id: data.conversation_flow_id,
      shared_tool_ids: data.shared_tool_ids,
      tools_count: tools.length,
      tools: tools.map((t) => ({
        type: t.type,
        name: t.name || t.function?.name,
        url: t.url || t.webhook?.url,
      })),
      greeting_preview: String(data.greeting || "").slice(0, 200),
      instructions_chars: String(data.instructions || "").length,
    },
    null,
    2,
  ),
);
