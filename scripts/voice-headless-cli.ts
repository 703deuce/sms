#!/usr/bin/env npx tsx
/**
 * Interactive headless voice debugger.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/voice-headless-cli.ts
 */
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { hasLlmConfigured } from "@/lib/ai/llm-providers";
import { openAiChatWithTools, type OpenAiChatMessage } from "@/lib/voice/testing/openai-tool-chat";
import { invokeToolWebhook } from "@/lib/voice/testing/preprod-harness";
import { compileVoiceAgentPromptFromWizard } from "@/lib/voice/prompt/compile-voice-agent-prompt";
import { openAiToolsForConversationWorkflow } from "@/lib/voice/testing/headless/telnyx-tool-schemas";
import { getRecordingSmsOutbox } from "@/lib/voice/testing/headless/recording-sms";
import {
  cleanupHeadlessFixture,
  seedWoodbridgeHeadlessFixture,
} from "@/lib/voice/testing/headless/woodbridge-fixture";

async function main() {
  if (!hasLlmConfigured()) {
    console.error("Set OPENAI_API_KEY or DEEPSEEK_API_KEY.");
    process.exit(1);
  }

  const fixture = await seedWoodbridgeHeadlessFixture();
  const rl = readline.createInterface({ input, output });
  const tools = openAiToolsForConversationWorkflow();
  const messages: OpenAiChatMessage[] = [
    {
      role: "system",
      content: compileVoiceAgentPromptFromWizard(fixture.wizard),
    },
  ];

  console.log("Loaded: Woodbridge Plumbing Test");
  console.log("Mode: After-hours Voice Agent (headless)");
  console.log("Type caller lines. Empty line to exit.\n");

  try {
    while (true) {
      const line = (await rl.question("YOU:\n> ")).trim();
      if (!line) break;

      messages.push({ role: "user", content: line });
      const chat = await openAiChatWithTools({ messages, tools, temperature: 0.35 });
      const msg = chat.message;

      if (msg.role === "assistant" && "tool_calls" in msg && msg.tool_calls?.length) {
        messages.push(msg);
        for (const tc of msg.tool_calls) {
          const toolType = tc.function.name.replace(/-/g, "_");
          const args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
          console.log(`\nTOOL REQUEST: ${toolType}`);
          console.log(`ARGUMENTS: ${JSON.stringify(args)}`);

          const webhook = await invokeToolWebhook({
            ctx: fixture,
            toolType,
            body: args,
            callControlId: fixture.callControlId,
            conversationId: fixture.conversationId,
            fromE164: fixture.callerE164,
          });
          console.log(`WEBHOOK: ${webhook.status} ${JSON.stringify(webhook.json)}`);
          const sms = getRecordingSmsOutbox();
          if (sms.length) {
            const last = sms[sms.length - 1]!;
            console.log(`SMS ADAPTER: ${last.to} — "${last.body.slice(0, 120)}..."`);
          }

          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(webhook.json),
          });
        }
        const follow = await openAiChatWithTools({ messages, tools, temperature: 0.35 });
        const text =
          follow.message.role === "assistant" && typeof follow.message.content === "string"
            ? follow.message.content
            : "";
        if (text) {
          console.log(`\nAGENT:\n> ${text}\n`);
          messages.push({ role: "assistant", content: text });
        }
      } else {
        const text = msg.role === "assistant" && typeof msg.content === "string" ? msg.content : "";
        console.log(`\nAGENT:\n> ${text}\n`);
        if (text) messages.push({ role: "assistant", content: text });
      }
    }
  } finally {
    rl.close();
    await cleanupHeadlessFixture(fixture);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
